import { Context } from 'hono'

import i18n from '../i18n';
import { getBooleanValue, getJsonSetting, checkCfTurnstile, isAddressCountLimitReached } from '../utils';
import { newAddress, getAddressPrefix, generateRandomName, commonGetUserRole } from '../common'
import { CONSTANTS } from '../constants'

const bindAddressToUser = async (
    c: Context<HonoCustomType>,
    userId: number,
    addressId: number
) => {
    const bindResult = await c.env.DB.prepare(
        `INSERT INTO users_address (user_id, address_id) VALUES (?, ?)`
    ).bind(userId, addressId).run();
    if (!bindResult.success) {
        throw new Error("Failed to bind address to user");
    }
}

const createNewAddress = async (c: Context<HonoCustomType>) => {
    const msgs = i18n.getMessagesbyContext(c);
    const userPayload = c.get("userPayload");

    if (getBooleanValue(c.env.DISABLE_ANONYMOUS_USER_CREATE_EMAIL)
        && !userPayload
    ) {
        return c.text(msgs.NewAddressAnonymousDisabledMsg, 403)
    }
    if (!getBooleanValue(c.env.ENABLE_USER_CREATE_EMAIL)) {
        return c.text(msgs.NewAddressDisabledMsg, 403)
    }

    // Logged-in users should always respect their mailbox quota, even when
    // anonymous mailbox creation is still allowed for guests.
    if (userPayload) {
        const userRole = c.get("userRolePayload") || (await commonGetUserRole(c, userPayload.user_id))?.role;
        if (await isAddressCountLimitReached(c, userPayload.user_id, userRole)) {
            return c.text(msgs.MaxAddressCountReachedMsg, 400)
        }
    }

    // eslint-disable-next-line prefer-const
    let { name, domain, cf_token, enableRandomSubdomain } = await c.req.json();
    // check cf turnstile
    try {
        await checkCfTurnstile(c, cf_token);
    } catch (error) {
        return c.text(msgs.TurnstileCheckFailedMsg, 400)
    }
    // Check if custom email names are disabled from environment variable
    const disableCustomAddressName = getBooleanValue(c.env.DISABLE_CUSTOM_ADDRESS_NAME);

    // if no name or custom names are disabled, generate random name
    if (!name || disableCustomAddressName) {
        name = generateRandomName(c);
    }
    // check name block list
    try {
        const value = await getJsonSetting(c, CONSTANTS.ADDRESS_BLOCK_LIST_KEY);
        const blockList = (value || []) as string[];
        if (blockList.some((item) => name.includes(item))) {
            return c.text(`Name[${name}]is blocked`, 400)
        }
    } catch (error) {
        console.error(error);
    }
    try {
        const addressPrefix = await getAddressPrefix(c);
        const sourceMeta = c.req.header('CF-Connecting-IP')
            || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim()
            || c.req.header('X-Real-IP')
            || 'web:unknown';
        const res = await newAddress(c, {
            name, domain,
            enablePrefix: true,
            enableRandomSubdomain: getBooleanValue(enableRandomSubdomain),
            checkLengthByConfig: true,
            addressPrefix,
            sourceMeta
        });
        if (userPayload?.user_id && res.address_id) {
            try {
                await bindAddressToUser(c, Number(userPayload.user_id), res.address_id);
            } catch (error) {
                await c.env.DB.prepare(
                    `DELETE FROM address WHERE id = ?`
                ).bind(res.address_id).run();
                throw error;
            }
        }
        return c.json(res);
    } catch (e) {
        return c.text(`${msgs.FailedCreateAddressMsg}: ${(e as Error).message}`, 400)
    }
};

export default { createNewAddress };
