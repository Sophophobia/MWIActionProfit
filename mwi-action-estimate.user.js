// ==UserScript==
// @name         [银河奶牛]行动预估：完成后等级 / 产出总价 / 每小时收益
// @namespace    https://github.com/Sophophobia/MWIActionProfit
// @author       Sophophobia
// @homepageURL  https://github.com/Sophophobia/MWIActionProfit
// @updateURL    https://raw.githubusercontent.com/Sophophobia/MWIActionProfit/main/mwi-action-estimate.user.js
// @downloadURL  https://raw.githubusercontent.com/Sophophobia/MWIActionProfit/main/mwi-action-estimate.user.js
// @version      0.2.12
// @description  在行动详情面板里显示做完后技能等级、产出总价和每小时入账；另有全部行动的每小时收益排行
// @match        https://www.milkywayidle.com/*
// @match        https://www.milkywayidlecn.com/*
// @match        https://test.milkywayidle.com/*
// @match        https://test.milkywayidlecn.com/*
// @icon         https://www.milkywayidle.com/favicon.svg
// @require      https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.5.0/lz-string.min.js
// @grant        none
// @run-at       document-start
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    /* ================= 配置 ================= */
    const CONFIG = {
        sellSide: 'bid',          // 产出按什么价卖：'bid' = 直接卖给买单（保守）；'ask' = 挂单价（乐观）
        buySide: 'ask',           // 原料按什么价买：'ask' = 直接从卖单买
        marketTax: 0.04,          // 市场税 4%
        includeEssence: true,     // 精华计入收益
        includeRare: true,        // 稀有掉落按期望值计入收益
        marketCacheMinutes: 30,   // 市场价缓存时间
        color: '#f0a020',
    };

    const LOG = (...a) => console.log('[行动预估]', ...a);

    /* ================= 语言：跟游戏设置走，没有就跟浏览器/系统 ================= */
    const I18N = {
        zh: {
            waitData: '等待游戏数据…',
            noAction: '没识别出是哪个行动',
            noDuration: '读不到行动时间',
            levelAfter: (a, b) => `${a} → ${b}`,
            levelUp: n => `+${n}级`,
            totalXp: x => `总经验：+${x}`,
            xpSuffix: x => ` · +${x} 经验`,
            valueBoth: (v, n) => `总价 <b>${v}</b> · 扣原料 <b>${n}</b>`,
            noSkillExp: x => `总经验：+${x}（还没拿到当前经验，刷新一下页面）`,
            unlimited: '无限次数：只显示每小时收益',
            noMaterials: '现有材料一次都不够做',
            autoCount: (n, h) => `用完材料：<b>${n}</b> 次 · ${h}`,
            marketLoading: '市场价加载中…',
            totalValue: v => `总价 <b>${v}</b>（税后）`,
            netValue: v => `扣原料后：<b>${v}</b>（原料按卖单价买入）`,
            perHour: v => `每小时 <b>${v}</b>`,
            perHourBoth: (v, n) => `每小时 <b>${v}</b> · 扣原料 <b>${n}</b>`,
            gross: (g, c, tax) => `毛收入 ${g}${c ? `，原料 -${c}` : ''}，已扣 ${tax}% 税`,
            priceNote: bid => `卖价按${bid ? '买单价' : '卖单价'}计算，稀有掉落按期望值`,
            rankBtn: '📊 收益排行',
            rankTitle: '今日收益排行（每小时）',
            rankCan: '我能做的',
            rankAll: '全部',
            rankAllSkills: '全部技能',
            rankAllCats: '全部分类',
            rankSortValue: '按产值（不扣原料）',
            rankSortNet: '按利润（扣原料）',
            rankSortXp: '按经验',
            rankRefresh: '刷新',
            rankCols: ['#', '产出', '技能', '产值/h（不扣原料）', '利润/h（扣原料）', '经验/h'],
            rankNoBid: '无买单',
            rankNoAsk: '无卖单',
            rankNoBidTip: '市场上现在没人挂收购单，做出来没法立刻卖掉，只能自己挂卖单等人买，所以按 0 算',
            rankNoAskTip: '市场上现在没人挂卖单，按买单价算',
            rankSellBid: '卖价：直接卖给买单',
            rankSellAsk: '卖价：自己挂卖单',
            rankSellTip: '直接卖给买单：马上到账，价格偏低；自己挂卖单：按当前最低卖单价算，价格高但要等人买',
            rankPriceTime: t => `市场价时间：${t}`,
            rankNoMarket: '市场价还没加载好，稍等再点刷新',
            rankNoData: '游戏数据还没加载好',
            rankNoLevel: '（还没拿到技能等级，"我能做的"暂时显示全部）',
            rankNote: '按你当前的装备、茶和房屋加成估算。卖价看上面的选项，原料按卖单价买，已扣 4% 税；没扣茶的消耗；冷门物品成交量可能很小。',
            rankEmpty: '没有符合条件的行动',
        },
        en: {
            waitData: 'Waiting for game data…',
            noAction: 'Could not identify this action',
            noDuration: 'Could not read action duration',
            levelAfter: (a, b) => `${a} → ${b}`,
            levelUp: n => `+${n} lv`,
            totalXp: x => `Total XP: +${x}`,
            xpSuffix: x => ` · +${x} XP`,
            valueBoth: (v, n) => `Value <b>${v}</b> · net <b>${n}</b>`,
            noSkillExp: x => `Total XP: +${x} (current XP not loaded yet, try refreshing)`,
            unlimited: 'Unlimited: showing hourly income only',
            noMaterials: 'Not enough materials for even one action',
            autoCount: (n, h) => `All materials: <b>${n}</b> · ${h}`,
            marketLoading: 'Loading market prices…',
            totalValue: v => `Value <b>${v}</b> (after tax)`,
            netValue: v => `Minus inputs: <b>${v}</b> (inputs bought at ask)`,
            perHour: v => `Per hour <b>${v}</b>`,
            perHourBoth: (v, n) => `Per hour <b>${v}</b> · net <b>${n}</b>`,
            gross: (g, c, tax) => `Gross ${g}${c ? `, inputs -${c}` : ''}, ${tax}% tax deducted`,
            priceNote: bid => `Sold at ${bid ? 'bid' : 'ask'} price; rare drops counted as expected value`,
            rankBtn: '📊 Profit ranking',
            rankTitle: "Today's profit ranking (per hour)",
            rankCan: 'I can do',
            rankAll: 'All',
            rankAllSkills: 'All skills',
            rankAllCats: 'All categories',
            rankSortValue: 'By value (gross)',
            rankSortNet: 'By profit (minus inputs)',
            rankSortXp: 'By XP',
            rankRefresh: 'Refresh',
            rankCols: ['#', 'Output', 'Skill', 'Value/h (gross)', 'Profit/h (net)', 'XP/h'],
            rankNoBid: 'no buy orders',
            rankNoAsk: 'no sell orders',
            rankNoBidTip: 'Nobody has a buy order up right now, so you cannot sell instantly; counted as 0',
            rankNoAskTip: 'Nobody has a sell order up right now; using the buy order price',
            rankSellBid: 'Sell: instantly to buy orders',
            rankSellAsk: 'Sell: list at lowest ask',
            rankSellTip: 'Instant sell to buy orders is lower but immediate; listing at the lowest ask is higher but you wait for a buyer',
            rankPriceTime: t => `Market prices as of ${t}`,
            rankNoMarket: 'Market prices not loaded yet, try Refresh in a moment',
            rankNoData: 'Game data not loaded yet',
            rankNoLevel: ' (skill levels not loaded yet, "I can do" shows everything for now)',
            rankNote: 'Estimated with your current equipment, tea and house buffs. Sell price per the option above, inputs bought at ask, 4% tax deducted. Tea consumption not included. Niche items may have low trade volume.',
            rankEmpty: 'No actions match',
        },
    };
    function getLang() {
        let l = '';
        try { l = localStorage.getItem('i18nextLng') || ''; } catch (e) { /* 忽略 */ }
        l = (l || document.documentElement.lang || navigator.language || 'en').toLowerCase();
        return l.startsWith('zh') ? 'zh' : 'en';
    }
    const T = () => I18N[getLang()];

    /* ================= 1. 监听 WebSocket，拿技能经验和各类加成 =================
       和 MWITools 一样，劫持 MessageEvent.data 的 getter，游戏读消息时顺便解析一份 */
    const charData = { skills: {}, buffs: {}, src: {}, inv: {}, invVer: 0, invFull: false };
    window.__mwiActionEstimate = { charData };  // 调试用：控制台里可以看脚本记下的数据
    const seenEvents = new WeakSet();

    let myCharId = null;
    function ingest(msg) {
        if (!msg || typeof msg !== 'object') return;
        if (msg.type === 'init_character_data' && msg.character?.id != null) myCharId = msg.character.id;
        // 只认自己角色的技能数据：队伍、公会、查看别人资料时，消息里也可能带别人的技能
        const okType = !msg.type || msg.type === 'init_character_data' || msg.type === 'action_completed'
            || /skill/i.test(msg.type);
        const arr = okType ? (msg.characterSkills || msg.endCharacterSkills) : null;
        if (Array.isArray(arr)) {
            for (const s of arr) {
                if (!s || !s.skillHrid || typeof s.experience !== 'number') continue;
                if (myCharId != null && s.characterID != null && s.characterID !== myCharId) continue;
                charData.skills[s.skillHrid] = s.experience;
                charData.src[s.skillHrid] = { type: msg.type || '?', level: s.level, cid: s.characterID, t: Date.now() };
            }
        }
        // 背包：初始化时是完整列表，之后的消息只带变化的物品（带的是新的数量）
        const items = msg.characterItems || msg.endCharacterItems;
        if (Array.isArray(items)) {
            if (msg.characterItems && msg.type === 'init_character_data') { charData.inv = {}; charData.invFull = true; }
            for (const it of items) {
                if (!it || !it.itemHrid || (it.enhancementLevel || 0) !== 0) continue;
                if (it.itemLocationHrid && it.itemLocationHrid !== '/item_locations/inventory') continue;
                if (myCharId != null && it.characterID != null && it.characterID !== myCharId) continue;
                charData.inv[it.itemHrid] = it.count || 0;
            }
            charData.invVer++;
        }
        // communityActionTypeBuffsMap / houseActionTypeBuffsMap / consumableActionTypeBuffsMap / equipmentActionTypeBuffsMap ...
        for (const k of Object.keys(msg)) {
            if (k.endsWith('ActionTypeBuffsMap') && msg[k]) charData.buffs[k] = msg[k];
        }
    }

    try {
        const desc = Object.getOwnPropertyDescriptor(MessageEvent.prototype, 'data');
        const origGet = desc.get;
        desc.get = function () {
            const data = origGet.call(this);
            try {
                if (!seenEvents.has(this) && this.currentTarget instanceof WebSocket
                    && typeof data === 'string' && data.charCodeAt(0) === 123 /* { */) {
                    seenEvents.add(this);
                    ingest(JSON.parse(data));
                }
            } catch (e) { /* 忽略 */ }
            return data;
        };
        Object.defineProperty(MessageEvent.prototype, 'data', desc);
    } catch (e) {
        LOG('WebSocket 监听失败，改用 React 状态', e);
    }

    /* ================= 2. React 状态兜底（和你给的参考脚本同一个办法） ================= */
    function getGameState() {
        try {
            const el = document.querySelector('[class^="GamePage"]');
            if (!el) return null;
            for (const k of Reflect.ownKeys(el)) {
                if (typeof k === 'string' && k.startsWith('__reactFiber$')) {
                    const st = el[k]?.return?.stateNode?.state;
                    if (st) return st;
                }
            }
        } catch (e) { /* 忽略 */ }
        return null;
    }

    function syncFromState() {
        const st = getGameState();
        if (!st) return;
        if (Object.keys(charData.skills).length === 0) {
            const sk = st.characterSkills || st.characterSkillMap;
            if (Array.isArray(sk)) sk.forEach(s => s?.skillHrid && (charData.skills[s.skillHrid] = s.experience));
            else if (sk instanceof Map) sk.forEach((v, k) => (charData.skills[k] = v?.experience ?? v));
            else if (sk && typeof sk === 'object') Object.entries(sk).forEach(([k, v]) => (charData.skills[k] = v?.experience ?? v));
        }
        for (const k of Object.keys(st)) {
            if (k.endsWith('ActionTypeBuffsMap') && st[k] && !charData.buffs[k]) charData.buffs[k] = st[k];
        }
    }

    /* ================= 3. 游戏静态数据（行动、物品、经验表） ================= */
    let clientData = null;
    function getClientData() {
        if (clientData) return clientData;
        const raw = localStorage.getItem('initClientData');
        if (!raw) return null;
        try { clientData = JSON.parse(raw); } catch (e) {
            try { clientData = JSON.parse(LZString.decompressFromUTF16(raw)); } catch (e2) { /* 忽略 */ }
        }
        return clientData;
    }

    /* ================= 4. 市场价 ================= */
    const MARKET_KEY = 'mwi_action_estimate_market';
    let market = null;
    let marketLoading = false;
    let marketTime = 0;

    function loadMarket() {
        if (marketLoading) return;
        try {
            const c = JSON.parse(localStorage.getItem(MARKET_KEY) || 'null');
            if (c && Date.now() - c.ts < CONFIG.marketCacheMinutes * 60e3) { market = c.data; marketTime = c.mts || c.ts; return; }
            if (c && !market) { market = c.data; marketTime = c.mts || c.ts; } // 先用旧的，后台刷新
        } catch (e) { /* 忽略 */ }
        marketLoading = true;
        fetch(location.origin + '/game_data/marketplace.json', { cache: 'no-store' })
            .then(r => r.json())
            .then(j => {
                if (j && j.marketData) {
                    market = j.marketData;
                    marketTime = j.timestamp ? j.timestamp * 1000 : Date.now();
                    localStorage.setItem(MARKET_KEY, JSON.stringify({ ts: Date.now(), mts: marketTime, data: market }));
                }
            })
            .catch(e => LOG('市场价获取失败', e))
            .finally(() => { marketLoading = false; });
    }

    function price(hrid, side) {
        if (hrid === '/items/coin') return 1;
        const e = market?.[hrid]?.['0'];
        if (!e) return 0;
        const pick = s => (s === 'bid' ? e.b : e.a);
        let p = pick(side);
        if (p == null || p < 0) {
            // 卖：没有买单就卖不掉，算 0（以前会退回用卖单价，冷门物品会被挂得离谱的卖单价撑得很高）
            if (side === 'bid') return 0;
            p = pick('bid');
        }
        return p > 0 ? p : 0;
    }

    /* ================= 名字缓存：从游戏界面上学中文名，排行里用 ================= */
    const NAME_KEY = 'mwi_action_estimate_names';
    let nameCache = { a: {}, i: {} };
    try { nameCache = Object.assign(nameCache, JSON.parse(localStorage.getItem(NAME_KEY) || '{}')); } catch (e) { /* 忽略 */ }
    let nameDirty = false;
    function learnName(kind, hrid, name) {
        if (getLang() !== 'zh' || !hrid || !name || nameCache[kind][hrid] === name) return;
        if (!/[\u4e00-\u9fa5]/.test(name)) return;
        nameCache[kind][hrid] = name;
        nameDirty = true;
    }
    function saveNames() {
        if (!nameDirty) return;
        nameDirty = false;
        try { localStorage.setItem(NAME_KEY, JSON.stringify(nameCache)); } catch (e) { /* 忽略 */ }
    }
    // 技能页上的行动格子：名字 + 图标
    function harvestTiles(cd) {
        if (getLang() !== 'zh' || !cd?.actionDetailMap) return;
        document.querySelectorAll('[class*="SkillAction_skillAction"]').forEach(tile => {
            const name = tile.querySelector('[class*="SkillAction_name"]')?.textContent?.trim();
            const href = tile.querySelector('use')?.getAttribute('href') || '';
            const id = href.slice(href.lastIndexOf('#') + 1);
            if (!name || !id) return;
            for (const a of Object.values(cd.actionDetailMap)) {
                if (a.hrid.endsWith('/' + id)) { learnName('a', a.hrid, name); break; }
            }
        });
    }

    function hasBid(hrid) {
        if (hrid === '/items/coin') return true;
        const b = market?.[hrid]?.['0']?.b;
        return b != null && b > 0;
    }

    /* ================= 游戏自己的翻译：名字跟着游戏语言走 ================= */
    /* 游戏的中文翻译打包在某个 static/js/*.chunk.js 里，形如 "/items/giant_pouch":"巨大袋子"
       直接下载这个文件，把 "/items/..."、"/actions/..."、"/action_types/..." 的中文名提取出来，缓存到本地 */
    const ZH_KEY = 'mwi_action_estimate_zh_names_v2';
    let zhNames = null, zhLoading = false, zhFailedAt = 0;
    function loadZhNames() {
        if (zhNames || zhLoading || Date.now() - zhFailedAt < 60e3) return;
        const srcs = [...document.scripts].map(x => x.src).filter(u => u && u.startsWith(location.origin) && /\.js(\?|$)/.test(u));
        if (!srcs.length) return;
        try {
            const c = JSON.parse(localStorage.getItem(ZH_KEY) || 'null');
            if (c && srcs.includes(c.src) && c.map) { zhNames = c.map; return; }
        } catch (e) { /* 忽略 */ }
        zhLoading = true;
        (async () => {
            // 先试 main 以外的 chunk（翻译不在 main 里），最后才试 main
            srcs.sort((x, y) => /main\./.test(x) - /main\./.test(y));
            for (const src of srcs) {
                let txt;
                try { txt = await (await fetch(src)).text(); } catch (e) { continue; }
                const map = {}, len = {};
                const re = /"(\/(?:items|actions|action_types|action_categories)\/[a-z0-9_\/]+)":"((?:[^"\\]|\\.){1,200}?)"/g;
                let m;
                while ((m = re.exec(txt))) {
                    let v;
                    try { v = JSON.parse('"' + m[2] + '"'); } catch (e) { continue; }
                    if (!/[一-龥]/.test(v)) continue;
                    // 同一个 key 可能同时出现在"名字表"和"描述表"里，名字更短，取最短的
                    if (!(m[1] in map) || v.length < len[m[1]]) { map[m[1]] = v; len[m[1]] = v.length; }
                }
                if (Object.keys(map).length > 50) {
                    zhNames = map;
                    LOG('读到游戏中文名', Object.keys(map).length, '个，来自', src);
                    setTimeout(() => { try { renderRank(); } catch (e) { /* 忽略 */ } }, 0);
                    try { localStorage.setItem(ZH_KEY, JSON.stringify({ src, map })); } catch (e) { /* 忽略 */ }
                    break;
                }
            }
            if (!zhNames) { zhFailedAt = Date.now(); LOG('没找到游戏的中文翻译文件'); }
        })().finally(() => { zhLoading = false; });
    }
    function trFlat() {
        if (getLang() !== 'zh') return null;
        loadZhNames();
        return zhNames;
    }
    const trItem = h => trFlat()?.[h] || (getLang() === 'zh' ? nameCache.i[h] : null) || null;
    const trAction = h => trFlat()?.[h] || (getLang() === 'zh' ? nameCache.a[h] : null) || null;
    const trType = h => trFlat()?.[h] || null;

    /* ================= 5. 计算 ================= */
    function buffSum(actionTypeHrid, typeHrid) {
        let s = 0;
        for (const map of Object.values(charData.buffs)) {
            const arr = map?.[actionTypeHrid];
            if (!Array.isArray(arr)) continue;
            for (const b of arr) if (b && b.typeHrid === typeHrid) s += b.flatBoost || 0;
        }
        return s;
    }

    /* 左边导航栏上显示的技能等级和进度，比如 "挤奶 0.20% 90"
       用它来核对脚本记下的经验，对不上就以导航栏为准 */
    function readNavSkills() {
        const out = {};
        // 每个技能一行：展开时是 "挤奶0.20%90"，收起时是 "Milking90"，有加成时末尾是 "+3"
        document.querySelectorAll('[class*="NavigationBar_navigationLink"]').forEach(link => {
            const u = link.querySelector('use');
            const href = u ? (u.getAttribute('href') || u.getAttribute('xlink:href') || '') : '';
            if (!href.includes('skills_sprite')) return;
            const id = href.slice(href.lastIndexOf('#') + 1);
            const m = (link.textContent || '').trim().match(/(?:([\d.]+)\s*%)?\s*(\d+)(?:\s*\+\s*\d+)?\s*$/);
            if (id && m) out['/skills/' + id] = { pct: m[1] != null ? parseFloat(m[1]) / 100 : null, lv: parseInt(m[2], 10) };
        });
        return out;
    }
    window.__mwiActionEstimate.readNavSkills = readNavSkills;
    const mismatchLogged = {};
    let navCache = { t: 0, v: {} };
    function skillExp(skillHrid, table) {
        if (Date.now() - navCache.t > 1000) navCache = { t: Date.now(), v: readNavSkills() };
        const nav = navCache.v[skillHrid];
        const exp = charData.skills[skillHrid];
        if (!nav || !table || table[nav.lv] == null) return exp;
        if (exp != null && levelFromExp(exp, table).lv === nav.lv) return exp; // 一致，用精确值
        if (exp != null && !mismatchLogged[skillHrid]) {
            mismatchLogged[skillHrid] = true;
            LOG('等级对不上，改用导航栏', skillHrid, '脚本记的经验', exp, '→ Lv', levelFromExp(exp, table).lv, '导航栏 Lv', nav.lv, '来源', charData.src[skillHrid]);
        }
        const lo = table[nav.lv], hi = table[nav.lv + 1] ?? lo;
        return lo + (nav.pct ?? 0) * (hi - lo);
    }

    function levelFromExp(exp, table) {
        let lv = 1;
        for (let i = 1; i < table.length; i++) { if (table[i] <= exp) lv = i; else break; }
        const cur = table[lv], next = table[lv + 1];
        const pct = next != null ? (exp - cur) / (next - cur) : 1;
        return { lv, pct };
    }

    // 从面板读一行的值，比如 "持续时间" -> "11.43s"
    function readRow(panel, labels) {
        for (const el of panel.querySelectorAll('div, span')) {
            if (el.children.length) continue;
            const t = el.textContent.trim();
            if (labels.includes(t)) {
                const v = el.nextElementSibling || el.parentElement?.nextElementSibling;
                if (v) return v.textContent.trim();
            }
        }
        return null;
    }

    // "需要" 那一栏里只看以 "Lv." 开头的那一小段文字，免得和后面的材料数量连在一起
    function readReqLevel(panel) {
        for (const el of panel.querySelectorAll('div, span')) {
            if (el.children.length || !['需要', 'Requires'].includes(el.textContent.trim())) continue;
            const v = el.nextElementSibling || el.parentElement?.nextElementSibling;
            if (!v) break;
            // 找第一个以 "Lv." 开头的文字节点（只看这一段文字本身）
            const w = document.createTreeWalker(v, NodeFilter.SHOW_TEXT);
            let n, txt = '';
            while ((n = w.nextNode())) { if (/^\s*Lv\./i.test(n.textContent)) { txt = n.textContent; break; } }
            const m = txt.match(/Lv\.?\s*(\d+)/i);
            return m ? parseInt(m[1], 10) : NaN;
        }
        return NaN;
    }

    function parseDuration(text) {
        if (!text) return null;
        let sec = 0, ok = false;
        const re = /([\d.]+)\s*(h|m|s)/gi;
        let m;
        while ((m = re.exec(text))) {
            ok = true;
            const n = parseFloat(m[1]);
            sec += m[2].toLowerCase() === 'h' ? n * 3600 : m[2].toLowerCase() === 'm' ? n * 60 : n;
        }
        return ok && sec > 0 ? sec : null;
    }

    function parsePercent(text) {
        if (!text) return null;
        const m = text.match(/([+-]?[\d.]+)\s*%/);
        return m ? parseFloat(m[1]) / 100 : null;
    }

    function findActionHrid(panel, cd) {
        const isAct = v => typeof v === 'string' && !!cd.actionDetailMap[v];

        // 0. 先按面板标题对行动名（游戏中文名或英文名），对上就不用猜了
        const title = panel.querySelector('[class*="SkillActionDetail_name"]')?.textContent?.trim();
        const activeSkill = document.querySelector('[class*="NavigationBar_active"] use')?.getAttribute('href')?.split('#')[1];
        if (title) {
            const byName = Object.values(cd.actionDetailMap).filter(a => a.name === title || trAction(a.hrid) === title);
            if (byName.length === 1) return byName[0].hrid;
            const same = byName.find(a => a.type === '/action_types/' + activeSkill);
            if (same) return same.hrid;
        }

        // 面板里出现的物品图标，比如 #holy_milk -> /items/holy_milk
        // 只看游戏自己的部分：别的 mod 加进来的东西（比如"本次生产摘要"里加工茶产出的奶酪）不算
        const icons = new Set();
        panel.querySelectorAll('use').forEach(u => {
            if (u.closest('[class*="mwi-"], .mwi-action-estimate')) return;
            const h = u.getAttribute('href') || u.getAttribute('xlink:href') || '';
            const i = h.lastIndexOf('#');
            if (i >= 0) icons.add('/items/' + h.slice(i + 1));
        });
        const reqLv = readReqLevel(panel);

        // 给每个行动打分：产出必须都在面板上，原料也要对得上，等级要求一致加分
        const score = a => {
            const outs = [...(a.outputItems || []), ...(a.dropTable || [])].map(x => x.itemHrid);
            if (!outs.length || !outs.every(h => icons.has(h))) return -1;
            const ins = (a.inputItems || []).map(x => x.itemHrid);
            if (!ins.every(h => icons.has(h))) return -1;
            let sc = outs.length * 2 + ins.length + (a.upgradeItemHrid && icons.has(a.upgradeItemHrid) ? 1 : 0);
            if (reqLv) sc += a.levelRequirement?.level === reqLv ? 5 : -5;
            if (activeSkill && a.type === '/action_types/' + activeSkill) sc += 3;
            return sc;
        };

        // React props 里出现的 /actions/xxx 只当"候选"，必须和面板图标对得上才算
        // （之前直接用第一个找到的，会拿到正在进行的别的行动）
        const propCands = new Set();
        const scan = (obj, depth) => {
            if (!obj || typeof obj !== 'object' || depth > 2 || obj.$$typeof || obj instanceof Node) return;
            let entries;
            try { entries = obj instanceof Map ? [...obj.entries()] : Object.entries(obj); } catch (e) { return; }
            if (entries.length > 300) return;
            for (const [k, v] of entries) {
                if (k === 'children' || (typeof k === 'string' && k.startsWith('_'))) continue;
                if (isAct(v)) propCands.add(v);
                else if (v && typeof v === 'object') scan(v, depth + 1);
            }
        };
        const key = Object.keys(panel).find(k => k.startsWith('__reactFiber$'));
        let f = key ? panel[key] : null;
        for (let i = 0; f && i < 40; i++, f = f.return) scan(f.memoizedProps, 0);

        let best = null, bestScore = 0;
        for (const h of propCands) {
            const sc = score(cd.actionDetailMap[h]);
            if (sc > bestScore) { bestScore = sc; best = h; }
        }
        if (best) return best;

        for (const a of Object.values(cd.actionDetailMap)) {
            const sc = score(a);
            if (sc > bestScore) { bestScore = sc; best = a.hrid; }
        }
        if (best) return best;

        // 英文界面按名字匹配
        const name = panel.querySelector('[class*="SkillActionDetail_name"]')?.textContent?.trim();
        const hit = name && Object.values(cd.actionDetailMap).find(a => a.name === name);
        if (hit) return hit.hrid;

        LOG('识别失败，面板图标：', [...icons], '需要等级：', reqLv, 'props 候选：', [...propCands]);
        return null;
    }

    function parseNum(t) {
        const m = String(t).replace(/,/g, '').trim().match(/^([\d.]+)\s*([KMB])?$/i);
        if (!m) return null;
        return parseFloat(m[1]) * ({ k: 1e3, m: 1e6, b: 1e9 }[(m[2] || '').toLowerCase()] || 1);
    }
    // 面板"需要"那几行：  拥有数 / 每次消耗  [物品图标]
    function panelOwned(panel) {
        const out = {};
        panel.querySelectorAll('div, span').forEach(el => {
            if (el.children.length || el.closest('[class*="mwi-"], .mwi-action-estimate')) return;
            const m = el.textContent.trim().match(/^([\d.,]+\s*[KMB]?)\s*\/\s*[\d.,]+\s*[KMB]?$/i);
            if (!m) return;
            let row = el.parentElement;
            for (let i = 0; row && i < 3; i++, row = row.parentElement) {
                const u = row.querySelector('use');
                if (!u) continue;
                const h = u.getAttribute('href') || u.getAttribute('xlink:href') || '';
                const n = parseNum(m[1]);
                if (n != null) out['/items/' + h.slice(h.lastIndexOf('#') + 1)] = n;
                break;
            }
        });
        return out;
    }

    function compute(panel, count) {
        const cd = getClientData();
        if (!cd?.actionDetailMap) return { err: T().waitData };
        const hrid = findActionHrid(panel, cd);
        const act = hrid && cd.actionDetailMap[hrid];
        if (!act) return { err: T().noAction };

        const type = act.type;
        const skillHrid = act.experienceGain?.skillHrid;
        const table = cd.levelExperienceTable;
        const curExp = skillExp(skillHrid, table);
        const curLv = curExp != null && table ? levelFromExp(curExp, table).lv : null;

        // 时间：优先读面板上显示的，读不到再估算
        let dur = parseDuration(readRow(panel, ['持续时间', '行动时间', 'Duration']));
        if (!dur) dur = (act.baseTimeCost || 0) / 1e9 / (1 + buffSum(type, '/buff_types/action_speed'));
        let eff = parsePercent(readRow(panel, ['当前效率', '效率', 'Efficiency']));
        if (eff == null) {
            const lvBonus = curLv != null ? Math.max(0, curLv - (act.levelRequirement?.level || 0)) * 0.01 : 0;
            eff = lvBonus + buffSum(type, '/buff_types/efficiency');
        }
        if (!dur) return { err: T().noDuration };

        const actionsPerHour = 3600 / dur * (1 + eff);
        const xpPer = (act.experienceGain?.value || 0) * (1 + buffSum(type, '/buff_types/wisdom'));

        // 每次行动的期望产出与消耗
        const outs = {}; // hrid -> 数量
        const add = (h, n) => { if (n > 0) outs[h] = (outs[h] || 0) + n; };
        const gathering = buffSum(type, '/buff_types/gathering');
        const gourmet = buffSum(type, '/buff_types/gourmet');
        const essFind = buffSum(type, '/buff_types/essence_find');
        const rareFind = buffSum(type, '/buff_types/rare_find');
        const artisan = buffSum(type, '/buff_types/artisan');

        (act.outputItems || []).forEach(o => add(o.itemHrid, o.count * (1 + gourmet)));
        (act.dropTable || []).forEach(d => add(d.itemHrid, d.dropRate * (d.minCount + d.maxCount) / 2 * (1 + gathering)));
        if (CONFIG.includeEssence) (act.essenceDropTable || []).forEach(d => add(d.itemHrid, d.dropRate * (1 + essFind) * (d.minCount + d.maxCount) / 2));
        if (CONFIG.includeRare) (act.rareDropTable || []).forEach(d => add(d.itemHrid, d.dropRate * (1 + rareFind) * (d.minCount + d.maxCount) / 2));

        const ins = {};
        (act.inputItems || []).forEach(i => (ins[i.itemHrid] = (ins[i.itemHrid] || 0) + i.count * (1 - artisan)));
        if (act.upgradeItemHrid) ins[act.upgradeItemHrid] = (ins[act.upgradeItemHrid] || 0) + 1;

        let grossPer = 0, costPer = 0;
        const lines = [];
        const shown = {};
        panel.querySelectorAll('use').forEach(u => {
            const href = u.getAttribute('href') || u.getAttribute('xlink:href') || '';
            const i = href.lastIndexOf('#');
            const t = u.closest('svg')?.parentElement?.textContent?.trim();
            if (i >= 0 && t && t.length <= 20 && !/^[\d.~%\s-]+$/.test(t)) shown['/items/' + href.slice(i + 1)] = t;
        });
        Object.entries(shown).forEach(([h, n]) => learnName('i', h, n));
        const itemName = h => trItem(h) || shown[h] || cd.itemDetailMap?.[h]?.name || h.replace('/items/', '');
        for (const [h, n] of Object.entries(outs)) {
            const v = n * price(h, CONFIG.sellSide);
            grossPer += v;
            lines.push({ h, n, v, name: itemName(h) });
        }
        for (const [h, n] of Object.entries(ins)) costPer += n * price(h, CONFIG.buySide);

        const netPer = grossPer * (1 - CONFIG.marketTax) - costPer;
        const valuePer = grossPer * (1 - CONFIG.marketTax);

        // 次数是无限、但要消耗材料：按把现有材料用完来算
        let auto = null;
        if (!count && Object.keys(ins).length) {
            const dom = panelOwned(panel);
            let max = Infinity, missing = false;
            for (const [h, per] of Object.entries(ins)) {
                const owned = charData.inv[h] != null ? charData.inv[h] : (dom[h] != null ? dom[h] : (charData.invFull ? 0 : null));
                if (owned == null) { missing = true; break; }
                if (per > 0) max = Math.min(max, owned / per);
            }
            if (!missing && isFinite(max)) {
                count = Math.floor(max);
                auto = { count };
            }
        }
        const res = {
            hrid,
            hasMarket: !!market,
            perHour: netPer * actionsPerHour,
            valuePerHour: valuePer * actionsPerHour,
            grossPerHour: grossPer * actionsPerHour,
            costPerHour: costPer * actionsPerHour,
            lines,
            hasInputs: Object.keys(ins).length > 0,
            auto,
        };

        if (count) {
            res.count = count;
            res.hours = count / actionsPerHour;
            res.totalXp = xpPer * count;
            res.gross = grossPer * count;
            res.net = netPer * count;
            res.value = valuePer * count;
            res.cost = costPer * count;
            res.lines = lines.map(l => ({ ...l, n: l.n * count, v: l.v * count }));
            if (curExp != null && table) {
                res.before = levelFromExp(curExp, table);
                res.after = levelFromExp(curExp + res.totalXp, table);
            }
        }
        return res;
    }

    /* ================= 6. 显示 ================= */
    function fmt(n) {
        const a = Math.abs(n);
        if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
        if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M';
        if (a >= 1e3) return (n / 1e3).toFixed(1) + 'K';
        return n.toFixed(a < 10 ? 2 : 0);
    }
    const pct = p => (p * 100).toFixed(1) + '%';
    const fmt0 = n => n >= 1e4 ? fmt(n) : String(Math.round(n));
    function fmtHours(h) {
        if (!isFinite(h)) return '∞';
        const m = Math.round(h * 60);
        return Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm';
    }

    function getCountInput(panel) {
        return panel.querySelector('[class*="maxActionCountInput"] input') || panel.querySelector('input');
    }

    function readCount(input) {
        const v = (input?.value || '').replace(/,/g, '').trim();
        if (!v || v.includes('∞')) return null; // 无限
        const n = parseFloat(v);
        return n > 0 && isFinite(n) ? n : null;
    }

    // 找到"耗时 xxx"那段文字（别的 mod 加的）
    function findTimeEl(panel, box) {
        for (const el of panel.querySelectorAll('div, span')) {
            if (el.children.length || box.contains(el)) continue;
            if (!/^(耗时|Time)/.test(el.textContent.trim())) continue;
            // 往上爬到整个"耗时 xxx"的外层，但不能包住输入框
            let t = el;
            while (t.parentElement && !t.parentElement.querySelector('input')
                && /^(耗时|Time)/.test(t.parentElement.textContent.trim())) t = t.parentElement;
            return t;
        }
        return null;
    }

    // 找某个标签文字本身（比如"持续时间"）
    function findLabel(panel, labels, box) {
        for (const el of panel.querySelectorAll('div, span')) {
            if (el.children.length || box.contains(el)) continue;
            if (labels.includes(el.textContent.trim())) return el;
        }
        return null;
    }

    // 放在"持续时间"到"采集"之间那一段，右边的空白处
    // 不依赖面板的行结构：只看这段高度里，左边的文字/图标最右到哪
    function placeBeside(panel, box, input) {
        const label = findLabel(panel, ['持续时间', '行动时间', 'Duration'], box);
        if (!label || !input) return false;

        if (getComputedStyle(panel).position === 'static') panel.style.position = 'relative';
        if (box.parentElement !== panel) panel.appendChild(box);

        const top = label.getBoundingClientRect().top;
        const bottom = input.getBoundingClientRect().top - 2;
        if (bottom <= top) return false;

        let right = label.getBoundingClientRect().right;
        const inBand = rc => rc.height > 0 && (rc.top + rc.bottom) / 2 > top && (rc.top + rc.bottom) / 2 < bottom;
        const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = walker.nextNode())) {
            if (!n.textContent.trim() || box.contains(n)) continue;
            const r = document.createRange();
            r.selectNodeContents(n);
            const rc = r.getBoundingClientRect();
            if (inBand(rc)) right = Math.max(right, rc.right);
        }
        panel.querySelectorAll('svg, img').forEach(el => {
            if (box.contains(el)) return;
            const rc = el.getBoundingClientRect();
            if (inBand(rc)) right = Math.max(right, rc.right);
        });

        const pr = panel.getBoundingClientRect();
        Object.assign(box.style, {
            position: 'absolute',
            top: (top - pr.top + panel.scrollTop) + 'px',
            left: (right - pr.left + 20) + 'px',
            right: '14px',
            margin: '0', flexBasis: '', zIndex: '1', textAlign: 'left',
        });
        return true;
    }

    // 放不到右边空白处时：放在"耗时"后面；再不行就放在采集那一行下面
    function ensureBox(panel, input) {
        let box = panel.querySelector('.mwi-action-estimate');
        if (!box) {
            box = document.createElement('div');
            box.className = 'mwi-action-estimate';
            box.style.cssText = `font-size:12px;line-height:1.5;color:${CONFIG.color};padding:2px 8px;border-left:2px solid ${CONFIG.color};box-sizing:border-box;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`;
        }
        if (!panel.dataset.mwiInline && placeBeside(panel, box, input)) return box;
        // 放不下时：放到面板最底部，不会被按钮挡住
        Object.assign(box.style, { position: '', top: '', left: '', right: '', zIndex: '', textAlign: 'left', flexBasis: '', margin: '8px 0 2px' });
        if (box.parentElement !== panel || panel.lastElementChild !== box) panel.appendChild(box);
        return box;
    }

    // 先试右边空白（12px → 11px），都放不下再放到面板底部
    function fitBox(panel, box, input) {
        const overflow = () => box.style.position === 'absolute'
            && (box.getBoundingClientRect().bottom > input.getBoundingClientRect().top - 2 || box.scrollWidth > box.clientWidth + 1);
        delete panel.dataset.mwiInline;
        box.style.fontSize = '12px';
        ensureBox(panel, input);
        if (!overflow()) return;
        box.style.fontSize = '11px';
        if (!overflow()) return;
        box.style.fontSize = '12px';
        panel.dataset.mwiInline = '1';
        ensureBox(panel, input);
    }

    const lastSig = new WeakMap();

    function render(panel) {
        const input = getCountInput(panel);
        if (!input) return;
        const count = readCount(input);
        const box = ensureBox(panel, input);
        const name = panel.querySelector('[class*="SkillActionDetail_name"]')?.textContent || '';
        const sig = [getLang(), name, count, JSON.stringify(charData.skills).length, !!market, Object.keys(charData.buffs).length, charData.invVer].join('|');
        if (lastSig.get(panel) === sig && box.innerHTML) return;
        lastSig.set(panel, sig);

        const r = compute(panel, count);
        if (r.err) { box.textContent = r.err; return; }
        learnName('a', r.hrid, name.trim());

        const t = T();
        const html = [];
        const cnt = count || (r.auto && r.auto.count);
        if (r.auto) html.push(r.auto.count > 0 ? t.autoCount(fmt0(r.auto.count), fmtHours(r.hours)) : t.noMaterials);
        if (cnt) {
            if (r.before && r.after) {
                const up = r.after.lv - r.before.lv;
                const a = `Lv.${r.before.lv}`;
                const b = `<b>Lv.${r.after.lv}</b> (${pct(r.after.pct)})`;
                html.push(t.levelAfter(a, b) + (up > 0 ? ` <b>${t.levelUp(up)}</b>` : '') + t.xpSuffix(fmt(r.totalXp)));
            } else {
                html.push(t.noSkillExp(fmt(r.totalXp)));
            }
        } else if (!r.auto) {
            html.push(t.unlimited);
        }

        const link = ` <a class="mwi-rank-open" title="${esc(t.rankBtn)}" style="color:#7ab8ff;cursor:pointer;text-decoration:none;">📊</a>`;
        if (!r.hasMarket) {
            html.push(t.marketLoading + link);
        } else {
            if (cnt) html.push(r.hasInputs ? t.valueBoth(fmt(r.value), fmt(r.net)) : t.totalValue(fmt(r.value)));
            html.push((r.hasInputs ? t.perHourBoth(fmt(r.valuePerHour), fmt(r.perHour)) : t.perHour(fmt(r.valuePerHour))) + link);
        }
        box.innerHTML = html.join('<br>');
        fitBox(panel, box, input);

        // 鼠标悬停看明细
        box.title = r.lines
            .sort((a, b) => b.v - a.v)
            .map(l => `${l.name}  ×${l.n < 10 ? l.n.toFixed(3) : fmt(l.n)}  ≈ ${fmt(l.v)}`)
            .join('\n')
            + (cnt && r.hasMarket ? '\n\n' + t.gross(fmt(r.gross), r.hasInputs ? fmt(r.cost) : '', CONFIG.marketTax * 100) : '')
            + '\n\n' + t.priceNote(CONFIG.sellSide === 'bid');
    }

    /* ================= 8. 收益排行 ================= */
    const RANK_SKILLS = ['milking', 'foraging', 'woodcutting', 'cheesesmithing', 'crafting', 'tailoring', 'cooking', 'brewing'];
    const SKILL_ZH = { milking: '挤奶', foraging: '采摘', woodcutting: '伐木', cheesesmithing: '奶酪锻造', crafting: '制作', tailoring: '缝纫', cooking: '烹饪', brewing: '冲泡' };
    const RANK_PREF_KEY = 'mwi_action_estimate_rank_pref';
    let rankPref = { scope: 'can', skill: '', cat: '', sort: 'value', sell: 'bid' };
    try { rankPref = Object.assign(rankPref, JSON.parse(localStorage.getItem(RANK_PREF_KEY) || '{}')); } catch (e) { /* 忽略 */ }
    const saveRankPref = () => { try { localStorage.setItem(RANK_PREF_KEY, JSON.stringify(rankPref)); } catch (e) { /* 忽略 */ } };

    const esc = x => String(x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function skillLabel(cd, type) {
        const key = type.replace('/action_types/', '');
        const tr = trType(type);
        if (tr) return tr;
        if (getLang() === 'zh' && SKILL_ZH[key]) return SKILL_ZH[key];
        return cd.actionTypeDetailMap?.[type]?.name || key;
    }

    // 对所有采集/生产行动，按当前加成算每小时收益
    function catLabel(cd, hrid) {
        return trFlat()?.[hrid] || cd.actionCategoryDetailMap?.[hrid]?.name || hrid.split('/').pop().replace(/_/g, ' ');
    }
    // 某个技能下的分类（材料、脚部、手部……），按游戏里的顺序
    function catsOfSkill(cd, skillKey) {
        const set = new Set();
        for (const a of Object.values(cd.actionDetailMap)) {
            if (a.type === '/action_types/' + skillKey && a.category) set.add(a.category);
        }
        const idx = h => cd.actionCategoryDetailMap?.[h]?.sortIndex ?? 999;
        return [...set].sort((x, y) => idx(x) - idx(y));
    }

    function rankRows(cd, sellSide) {
        const table = cd.levelExperienceTable;
        const rows = [];
        for (const act of Object.values(cd.actionDetailMap)) {
            const key = (act.type || '').replace('/action_types/', '');
            if (!RANK_SKILLS.includes(key)) continue;
            const mainOuts = [...(act.outputItems || []), ...(act.dropTable || [])];
            if (!mainOuts.length || !act.baseTimeCost) continue;

            const type = act.type;
            const exp = skillExp(act.experienceGain?.skillHrid, table);
            const lv = exp != null && table ? levelFromExp(exp, table).lv : null;
            const req = act.levelRequirement?.level || 1;

            const dur = act.baseTimeCost / 1e9 / (1 + buffSum(type, '/buff_types/action_speed'));
            const eff = (lv != null ? Math.max(0, lv - req) * 0.01 : 0) + buffSum(type, '/buff_types/efficiency');
            const aph = 3600 / dur * (1 + eff);

            const gathering = buffSum(type, '/buff_types/gathering');
            const gourmet = buffSum(type, '/buff_types/gourmet');
            const essFind = buffSum(type, '/buff_types/essence_find');
            const rareFind = buffSum(type, '/buff_types/rare_find');
            const artisan = buffSum(type, '/buff_types/artisan');

            let gross = 0, cost = 0;
            (act.outputItems || []).forEach(o => (gross += o.count * (1 + gourmet) * price(o.itemHrid, sellSide)));
            (act.dropTable || []).forEach(d => (gross += d.dropRate * (d.minCount + d.maxCount) / 2 * (1 + gathering) * price(d.itemHrid, sellSide)));
            if (CONFIG.includeEssence) (act.essenceDropTable || []).forEach(d => (gross += d.dropRate * (1 + essFind) * (d.minCount + d.maxCount) / 2 * price(d.itemHrid, sellSide)));
            if (CONFIG.includeRare) (act.rareDropTable || []).forEach(d => (gross += d.dropRate * (1 + rareFind) * (d.minCount + d.maxCount) / 2 * price(d.itemHrid, sellSide)));
            (act.inputItems || []).forEach(i => (cost += i.count * (1 - artisan) * price(i.itemHrid, CONFIG.buySide)));
            if (act.upgradeItemHrid) cost += price(act.upgradeItemHrid, CONFIG.buySide);

            const value = gross * (1 - CONFIG.marketTax);
            const iconItem = mainOuts[0].itemHrid;
            rows.push({
                hrid: act.hrid,
                name: trAction(act.hrid) || trItem(iconItem) || (getLang() === 'zh' ? (nameCache.a[act.hrid] || nameCache.i[iconItem]) : null) || act.name,
                noBid: sellSide === 'bid' && mainOuts.every(o => !hasBid(o.itemHrid)),
                noAsk: sellSide === 'ask' && mainOuts.every(o => !(market?.[o.itemHrid]?.['0']?.a > 0)),
                icon: iconItem.replace('/items/', ''),
                skillKey: key,
                cat: act.category || '',
                skill: skillLabel(cd, type),
                req, lv,
                can: lv == null ? null : lv >= req,
                hasInputs: !!((act.inputItems || []).length || act.upgradeItemHrid),
                value: value * aph,
                net: (value - cost) * aph,
                xp: (act.experienceGain?.value || 0) * (1 + buffSum(type, '/buff_types/wisdom')) * aph,
            });
        }
        return rows;
    }

    function itemSprite() {
        for (const u of document.querySelectorAll('use')) {
            const h = u.getAttribute('href') || u.getAttribute('xlink:href') || '';
            if (h.includes('items_sprite')) return h.slice(0, h.lastIndexOf('#'));
        }
        return '';
    }

    function renderRank() {
        const modal = document.getElementById('mwi-rank-modal');
        if (!modal) return;
        const t = T();
        const body = modal.querySelector('.mwi-rank-body');
        const meta = modal.querySelector('.mwi-rank-meta');
        const cd = getClientData();
        if (!cd?.actionDetailMap) { body.innerHTML = `<div style="padding:16px">${t.rankNoData}</div>`; return; }
        if (!market) { body.innerHTML = `<div style="padding:16px">${t.rankNoMarket}</div>`; loadMarket(); return; }
        harvestTiles(cd);

        modal.querySelectorAll('[data-scope]').forEach(b => {
            const on = b.dataset.scope === rankPref.scope;
            b.style.background = on ? CONFIG.color : '#3a3f63';
            b.style.color = on ? '#111' : '#ddd';
        });
        modal.querySelector('.mwi-rank-skill').value = rankPref.skill;
        const catSel = modal.querySelector('.mwi-rank-cat');
        const cats = rankPref.skill ? catsOfSkill(cd, rankPref.skill) : [];
        if (cats.length > 1) {
            if (rankPref.cat && !cats.includes(rankPref.cat)) rankPref.cat = '';
            const html = `<option value="">${t.rankAllCats}</option>` + cats.map(c => `<option value="${esc(c)}">${esc(catLabel(cd, c))}</option>`).join('');
            // 内容变了（换技能、换语言、中文名刚加载完）就重画
            if (catSel.dataset.html !== html) {
                catSel.innerHTML = html;
                catSel.dataset.html = html;
            }
            catSel.value = rankPref.cat;
            catSel.style.display = '';
        } else {
            catSel.style.display = 'none';
            rankPref.cat = '';
        }
        modal.querySelector('.mwi-rank-sort').value = rankPref.sort;
        modal.querySelector('.mwi-rank-sell').value = rankPref.sell;

        let rows = rankRows(cd, rankPref.sell);
        const noLevel = rows.every(r => r.can == null);
        if (rankPref.scope === 'can' && !noLevel) rows = rows.filter(r => r.can);
        if (rankPref.skill) rows = rows.filter(r => r.skillKey === rankPref.skill);
        if (rankPref.skill && rankPref.cat) rows = rows.filter(r => r.cat === rankPref.cat);
        rows.sort((a, b) => b[rankPref.sort] - a[rankPref.sort]);

        const timeStr = marketTime ? new Date(marketTime).toLocaleString() : '-';
        meta.textContent = t.rankPriceTime(timeStr) + (rankPref.scope === 'can' && noLevel ? t.rankNoLevel : '');

        if (!rows.length) { body.innerHTML = `<div style="padding:16px">${t.rankEmpty}</div>`; return; }
        const sprite = itemSprite();
        const th = t.rankCols.map((c, i) => `<th style="text-align:${i >= 3 ? 'right' : 'left'};padding:6px 8px;position:sticky;top:0;background:#1f2240;">${c}</th>`).join('');
        const sortCol = { value: 3, net: 4, xp: 5 }[rankPref.sort];
        const td = (v, i, extra = '') => `<td style="padding:4px 8px;text-align:${i >= 3 ? 'right' : 'left'};${i === sortCol ? `color:${CONFIG.color};font-weight:bold;` : ''}${extra}">${v}</td>`;
        const trs = rows.map((r, idx) => {
            const icon = sprite ? `<svg width="20" height="20" style="vertical-align:middle;margin-right:6px;"><use href="${esc(sprite)}#${esc(r.icon)}"></use></svg>` : '';
            const lvTxt = `Lv.${r.req}` + (r.lv != null ? ` <span style="color:#888">(${r.lv})</span>` : '');
            return `<tr style="${r.can === false ? 'opacity:.45;' : ''}border-top:1px solid #2c3050;">`
                + td(idx + 1, 0, 'color:#888;')
                + td(icon + esc(r.name) + (r.noBid || r.noAsk ? ` <span style="color:#e06060;font-size:11px;" title="${esc(r.noBid ? t.rankNoBidTip : t.rankNoAskTip)}">${r.noBid ? t.rankNoBid : t.rankNoAsk}</span>` : ''), 1)
                + td(`${esc(r.skill)} ${lvTxt}`, 2)
                + td(fmt(r.value), 3)
                + td(r.hasInputs ? fmt(r.net) : '<span style="color:#666">=</span>', 4)
                + td(fmt(r.xp), 5)
                + '</tr>';
        }).join('');
        body.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:12px;color:#ddd;font-family:inherit;"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
    }

    function openRank() {
        const t = T();
        let modal = document.getElementById('mwi-rank-modal');
        if (modal) modal.remove();
        const cd = getClientData();
        modal = document.createElement('div');
        modal.id = 'mwi-rank-modal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;';
        const skillOpts = [`<option value="">${t.rankAllSkills}</option>`]
            .concat(RANK_SKILLS.map(k => `<option value="${k}">${esc(cd ? skillLabel(cd, '/action_types/' + k) : k)}</option>`)).join('');
        const btn = 'border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:12px;';
        const sel = 'background:#2a2e52;color:#ddd;border:1px solid #444a7a;border-radius:4px;padding:3px 6px;font-size:12px;';
        modal.innerHTML = `
            <div style="width:min(760px,94vw);max-height:84vh;display:flex;flex-direction:column;background:#181a33;color:#ddd;border:1px solid #444a7a;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,.6);text-align:left;">
                <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #2c3050;">
                    <b style="font-size:15px;flex:1;">${t.rankTitle}</b>
                    <button class="mwi-rank-refresh" style="${btn}background:#3a3f63;color:#ddd;">${t.rankRefresh}</button>
                    <button class="mwi-rank-close" style="${btn}background:transparent;color:#ddd;font-size:18px;padding:0 6px;">✕</button>
                </div>
                <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 14px;">
                    <button data-scope="can" style="${btn}">${t.rankCan}</button>
                    <button data-scope="all" style="${btn}">${t.rankAll}</button>
                    <select class="mwi-rank-skill" style="${sel}">${skillOpts}</select>
                    <select class="mwi-rank-cat" style="${sel}display:none;"></select>
                    <select class="mwi-rank-sort" style="${sel}">
                        <option value="value">${t.rankSortValue}</option>
                        <option value="net">${t.rankSortNet}</option>
                        <option value="xp">${t.rankSortXp}</option>
                    </select>
                    <select class="mwi-rank-sell" style="${sel}" title="${esc(t.rankSellTip)}">
                        <option value="bid">${t.rankSellBid}</option>
                        <option value="ask">${t.rankSellAsk}</option>
                    </select>
                    <span class="mwi-rank-meta" style="color:#888;font-size:11px;"></span>
                </div>
                <div class="mwi-rank-body" style="overflow:auto;flex:1;padding:0 6px;"></div>
                <div style="padding:8px 14px;color:#888;font-size:11px;border-top:1px solid #2c3050;">${t.rankNote}</div>
            </div>`;
        document.body.appendChild(modal);

        modal.addEventListener('click', e => {
            if (e.target === modal || e.target.closest('.mwi-rank-close')) { modal.remove(); return; }
            const sc = e.target.closest('[data-scope]');
            if (sc) { rankPref.scope = sc.dataset.scope; saveRankPref(); renderRank(); return; }
            if (e.target.closest('.mwi-rank-refresh')) {
                try { localStorage.removeItem(MARKET_KEY); } catch (err) { /* 忽略 */ }
                syncFromState();
                loadMarket();
                setTimeout(renderRank, 1500);
                renderRank();
            }
        });
        modal.addEventListener('change', e => {
            if (e.target.matches('.mwi-rank-skill')) { rankPref.skill = e.target.value; rankPref.cat = ''; }
            if (e.target.matches('.mwi-rank-cat')) rankPref.cat = e.target.value;
            if (e.target.matches('.mwi-rank-sort')) rankPref.sort = e.target.value;
            if (e.target.matches('.mwi-rank-sell')) rankPref.sell = e.target.value;
            saveRankPref();
            renderRank();
        });
        syncFromState();
        renderRank();
    }

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') document.getElementById('mwi-rank-modal')?.remove();
    });
    document.addEventListener('click', e => {
        if (e.target.closest?.('.mwi-rank-open')) { e.preventDefault(); e.stopPropagation(); openRank(); }
    }, true);

    // 页面右侧常驻的小按钮，不用打开行动面板也能看
    function ensureFloatBtn() {
        if (!document.body) return;
        let b = document.getElementById('mwi-rank-float');
        const label = T().rankBtn;
        if (!b) {
            b = document.createElement('div');
            b.id = 'mwi-rank-float';
            b.className = 'mwi-rank-open';
            b.style.cssText = `position:fixed;right:0;top:46%;z-index:9999;writing-mode:vertical-rl;padding:8px 4px;font-size:12px;cursor:pointer;background:rgba(40,44,80,.85);color:${CONFIG.color};border:1px solid ${CONFIG.color};border-right:none;border-radius:6px 0 0 6px;user-select:none;`;
            document.body.appendChild(b);
        }
        if (b.textContent !== label) b.textContent = label;
    }

    /* ================= 7. 主循环 ================= */
    function tick() {
        ensureFloatBtn();
        try { harvestTiles(getClientData()); } catch (e) { /* 忽略 */ }
        saveNames();
        const panels = document.querySelectorAll('[class*="SkillActionDetail_skillActionDetail"]');
        if (!panels.length) return;
        syncFromState();
        if (!market || Date.now() % (CONFIG.marketCacheMinutes * 60e3) < 600) loadMarket();
        panels.forEach(p => { try { render(p); } catch (e) { LOG('渲染出错', e); } });
    }

    // 输入框一变就立刻刷新
    document.addEventListener('input', e => {
        const p = e.target.closest?.('[class*="SkillActionDetail_skillActionDetail"]');
        if (p) { lastSig.delete(p); render(p); }
    }, true);
    document.addEventListener('click', e => {
        const p = e.target.closest?.('[class*="SkillActionDetail_skillActionDetail"]');
        if (p) setTimeout(() => { lastSig.delete(p); render(p); }, 50);
    }, true);

    loadMarket();
    setInterval(tick, 500);
})();
