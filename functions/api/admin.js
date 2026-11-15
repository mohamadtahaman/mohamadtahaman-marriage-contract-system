/**
 * Arresalah Zentrum Berlin - Admin API (Complete & Full Version)
 * Handles authentication, contracts listing, viewing, updating, dowry text/number handling, and audit logs.
 */

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const method = request.method;

    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };

    if (method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        let body = {};
        if (method === 'POST' || method === 'PUT') {
            try {
                body = await request.json();
            } catch (e) {
                body = {};
            }
        }

        const action = body.action || url.searchParams.get('action');

        // ==========================================
        // 1. ADMIN AUTHENTICATION
        // ==========================================
        if (action === 'login') {
            const { username, password } = body;
            // Validate credentials against environment variables or default admin settings
            const adminUser = env.ADMIN_USER || 'admin';
            const adminPass = env.ADMIN_PASS || 'admin2026';

            if (username === adminUser && password === adminPass) {
                return new Response(JSON.stringify({ 
                    success: true, 
                    token: 'admin_authenticated_session_token_' + Date.now(),
                    message: 'تم تسجيل الدخول بنجاح' 
                }), { headers: corsHeaders });
            } else {
                return new Response(JSON.stringify({ 
                    success: false, 
                    error: 'اسم المستخدم أو كلمة المرور غير صحيحة' 
                }), { status: 401, headers: corsHeaders });
            }
        }

        // ==========================================
        // 2. LIST ALL CONTRACTS
        // ==========================================
        if (action === 'list_contracts' || (method === 'GET' && !url.searchParams.get('code'))) {
            if (!env.DB) {
                return new Response(JSON.stringify({ success: false, error: 'Database not bound' }), { status: 500, headers: corsHeaders });
            }

            const contractsResult = await env.DB.prepare(`
                SELECT c.id, c.code, c.contract_date, c.status, c.created_at, c.updated_at,
                       p_groom.name_ar as groom_name_ar, p_groom.name_de as groom_name_de,
                       p_bride.name_ar as bride_name_ar, p_bride.name_de as bride_name_de
                FROM contracts c
                LEFT JOIN parties p_groom ON c.id = p_groom.contract_id AND p_groom.role = 'groom'
                LEFT JOIN parties p_bride ON c.id = p_bride.contract_id AND p_bride.role = 'bride'
                ORDER BY c.created_at DESC
            `).all();

            return new Response(JSON.stringify({ 
                success: true, 
                contracts: contractsResult.results || [] 
            }), { headers: corsHeaders });
        }

        // ==========================================
        // 3. VIEW SINGLE CONTRACT DETAILS
        // ==========================================
        if (action === 'view') {
            const code = body.code || url.searchParams.get('code');
            if (!code) {
                return new Response(JSON.stringify({ success: false, error: 'Code is required' }), { status: 400, headers: corsHeaders });
            }

            if (!env.DB) {
                return new Response(JSON.stringify({ success: false, error: 'Database not bound' }), { status: 500, headers: corsHeaders });
            }

            const cRow = await env.DB.prepare(`SELECT * FROM contracts WHERE code = ?`).bind(code).first();
            if (!cRow) {
                return new Response(JSON.stringify({ success: false, error: 'Contract not found' }), { status: 404, headers: corsHeaders });
            }

            let contract = {
                id: cRow.id,
                code: cRow.code,
                contractDate: cRow.contract_date,
                status: cRow.status,
                createdAt: cRow.created_at,
                updatedAt: cRow.updated_at,
                parties: {},
                dowry: {}
            };

            // Fetch Parties
            const pRows = await env.DB.prepare(`SELECT * FROM parties WHERE contract_id = ?`).bind(cRow.id).all();
            if (pRows && pRows.results) {
                pRows.results.forEach(p => {
                    contract.parties[p.role] = {
                        nameDe: p.name_de,
                        nameAr: p.name_ar,
                        birthDay: p.birth_day,
                        birthMonth: p.birth_month,
                        birthYear: p.birth_year,
                        birthCountry: p.birth_country,
                        birthRegion: p.birth_region,
                        idType: p.id_type,
                        idNumber: p.id_number,
                        addressNumber: p.address_number,
                        addressStreet: p.address_street,
                        postalCode: p.postal_code,
                        city: p.city,
                        motherNameDe: p.mother_name_de,
                        motherNameAr: p.mother_name_ar
                    };
                });
            }

            // Fetch Dowry (Supports both Text and Numbers)
            const dRow = await env.DB.prepare(`SELECT * FROM dowries WHERE contract_id = ?`).bind(cRow.id).first();
            if (dRow) {
                contract.dowry = {
                    amountAdvance: dRow.amount_advance,   // TEXT column
                    amountDeferred: dRow.amount_deferred, // TEXT column
                    notes: dRow.notes
                };
            }

            return new Response(JSON.stringify({ success: true, contract }), { headers: corsHeaders });
        }

        // ==========================================
        // 4. UPDATE CONTRACT (FIXED: SAVE AFTER EDIT & TEXT DOWRY)
        // ==========================================
        if (action === 'update_contract') {
            const { code, contractDate, status, parties, dowry } = body;

            if (!code) {
                return new Response(JSON.stringify({ success: false, error: 'Contract code is required for update' }), { status: 400, headers: corsHeaders });
            }

            if (!env.DB) {
                return new Response(JSON.stringify({ success: false, error: 'Database not bound' }), { status: 500, headers: corsHeaders });
            }

            // Update main contract table
            await env.DB.prepare(`
                INSERT INTO contracts (code, contract_date, status, updated_at) 
                VALUES (?, ?, ?, CURRENT_TIMESTAMP) 
                ON CONFLICT(code) DO UPDATE SET 
                    contract_date = ?, 
                    status = ?, 
                    updated_at = CURRENT_TIMESTAMP
            `).bind(code, contractDate || null, status || 'draft', contractDate || null, status || 'draft').run();

            const contractRow = await env.DB.prepare(`SELECT id FROM contracts WHERE code = ?`).bind(code).first();
            if (!contractRow) {
                return new Response(JSON.stringify({ success: false, error: 'Failed to retrieve contract ID after update' }), { status: 500, headers: corsHeaders });
            }

            const contractId = contractRow.id;

            // Update Parties (Groom, Bride, Wali, Witness1, Witness2)
            if (parties && typeof parties === 'object') {
                for (const [role, pData] of Object.entries(parties)) {
                    if (!pData) continue;
                    await env.DB.prepare(`
                        INSERT INTO parties (
                            contract_id, role, name_de, name_ar, birth_day, birth_month, birth_year, 
                            birth_country, birth_region, id_type, id_number, address_number, 
                            address_street, postal_code, city, mother_name_de, mother_name_ar
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(contract_id, role) DO UPDATE SET
                            name_de = ?, name_ar = ?, birth_day = ?, birth_month = ?, birth_year = ?, 
                            birth_country = ?, birth_region = ?, id_type = ?, id_number = ?, address_number = ?, 
                            address_street = ?, postal_code = ?, city = ?, mother_name_de = ?, mother_name_ar = ?
                    `).bind(
                        contractId, role, 
                        pData.nameDe || '', pData.nameAr || '', pData.birthDay || '', pData.birthMonth || '', pData.birthYear || '', 
                        pData.birthCountry || '', pData.birthRegion || '', pData.idType || '', pData.idNumber || '', pData.addressNumber || '', 
                        pData.addressStreet || '', pData.postalCode || '', pData.city || '', pData.motherNameDe || '', pData.motherNameAr || '',
                        // Update values
                        pData.nameDe || '', pData.nameAr || '', pData.birthDay || '', pData.birthMonth || '', pData.birthYear || '', 
                        pData.birthCountry || '', pData.birthRegion || '', pData.idType || '', pData.idNumber || '', pData.addressNumber || '', 
                        pData.addressStreet || '', pData.postalCode || '', pData.city || '', pData.motherNameDe || '', pData.motherNameAr || ''
                    ).run();
                }
            }

            // Update Dowry (Accepts Text and Numbers freely in TEXT columns)
            if (dowry && typeof dowry === 'object') {
                await env.DB.prepare(`
                    INSERT INTO dowries (contract_id, amount_advance, amount_deferred, notes)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(contract_id) DO UPDATE SET
                        amount_advance = ?, 
                        amount_deferred = ?, 
                        notes = ?
                `).bind(
                    contractId, 
                    dowry.amountAdvance || '', 
                    dowry.amountDeferred || '', 
                    dowry.notes || '',
                    dowry.amountAdvance || '', 
                    dowry.amountDeferred || '', 
                    dowry.notes || ''
                ).run();
            }

            // Also sync with KV if available
            if (env.CONTRACT_KV) {
                await env.CONTRACT_KV.put(`contract_${code}_date`, contractDate || '');
                if (dowry) {
                    await env.CONTRACT_KV.put(`contract_${code}_dowry`, JSON.stringify(dowry));
                }
            }

            // Log audit event if table exists
            try {
                await env.DB.prepare(`
                    INSERT INTO audit_log (action_type, details, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)
                `).bind('UPDATE_CONTRACT', `Contract updated successfully for code: ${code}`).run();
            } catch (auditErr) {
                // Ignore audit table errors if table not created yet
            }

            return new Response(JSON.stringify({ 
                success: true, 
                message: 'تم حفظ التعديلات بنجاح في قاعدة البيانات' 
            }), { headers: corsHeaders });
        }

        // ==========================================
        // 5. DELETE CONTRACT
        // ==========================================
        if (action === 'delete_contract') {
            const { code } = body;
            if (!code) {
                return new Response(JSON.stringify({ success: false, error: 'Code is required' }), { status: 400, headers: corsHeaders });
            }

            if (!env.DB) {
                return new Response(JSON.stringify({ success: false, error: 'Database not bound' }), { status: 500, headers: corsHeaders });
            }

            const cRow = await env.DB.prepare(`SELECT id FROM contracts WHERE code = ?`).bind(code).first();
            if (cRow) {
                await env.DB.prepare(`DELETE FROM parties WHERE contract_id = ?`).bind(cRow.id).run();
                await env.DB.prepare(`DELETE FROM dowries WHERE contract_id = ?`).bind(cRow.id).run();
                await env.DB.prepare(`DELETE FROM contracts WHERE id = ?`).bind(cRow.id).run();
            }

            return new Response(JSON.stringify({ success: true, message: 'تم حذف العقد بنجاح' }), { headers: corsHeaders });
        }

        // ==========================================
        // 6. SYSTEM STATS & AUDIT LOGS
        // ==========================================
        if (action === 'stats') {
            if (!env.DB) {
                return new Response(JSON.stringify({ success: false, error: 'Database not bound' }), { status: 500, headers: corsHeaders });
            }

            const countResult = await env.DB.prepare(`SELECT COUNT(*) as total FROM contracts`).first();
            const draftResult = await env.DB.prepare(`SELECT COUNT(*) as draft FROM contracts WHERE status = 'draft'`).first();

            return new Response(JSON.stringify({
                success: true,
                stats: {
                    totalContracts: countResult ? countResult.total : 0,
                    draftContracts: draftResult ? draftResult.draft : 0
                }
            }), { headers: corsHeaders });
        }

        return new Response(JSON.stringify({ success: false, error: 'Invalid or unknown action requested' }), { status: 400, headers: corsHeaders });

    } catch (err) {
        return new Response(JSON.stringify({ 
            success: false, 
            error: 'Server Exception: ' + err.message,
            stack: err.stack 
        }), { status: 500, headers: corsHeaders });
    }
}
