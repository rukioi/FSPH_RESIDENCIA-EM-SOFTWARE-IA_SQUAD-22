import { jwtVerify } from 'jose';
export async function validarJwt(authorization) {
    if (!authorization?.startsWith('Bearer ')) {
        return null;
    }
    const token = authorization.slice(7).trim();
    const segredo = process.env.JWT_SECRET;
    if (!token || !segredo) {
        return null;
    }
    try {
        const chave = new TextEncoder().encode(segredo);
        const { payload } = await jwtVerify(token, chave, {
            algorithms: ['HS256'],
        });
        if (typeof payload.sub !== 'string' ||
            !payload.sub ||
            typeof payload.perfil !== 'string') {
            return null;
        }
        return {
            id: payload.sub,
            perfil: payload.perfil,
        };
    }
    catch {
        return null;
    }
}
