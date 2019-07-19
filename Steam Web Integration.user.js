// ==UserScript==
// @author       Revadike
// @collaborator Black3ird
// @collaborator Lex
// @collaborator Luckz
// @connect      bartervg.com
// @connect      steam-tracker.com
// @connect      store.steampowered.com
// @description  Check every web page for game, dlc and package links to the steam store and mark using icons whether it's owned, unowned, wishlisted, ignored (not interested), removed/delisted (decommissioned), has low confidence metric, has cards, or is bundled.
// @downloadURL  https://github.com/Revadike/SteamWebIntegration/raw/master/Steam%20Web%20Integration.user.js
// @exclude      /^https?\:\/\/(.+.steampowered|steamcommunity).com\/(?!groups\/groupbuys).*/
// @grant        GM_getValue
// @grant        GM_info
// @grant        GM_openInTab
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @homepageURL  https://www.steamgifts.com/discussion/y9vVm/
// @icon         https://store.steampowered.com/favicon.ico
// @include      /^https?\:\/\/.+/
// @name         Steam Web Integration
// @namespace    Royalgamer06
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require      https://raw.githubusercontent.com/kapetan/jquery-observe/master/jquery-observe.js
// @run-at       document-start
// @supportURL   https://github.com/Revadike/SteamWebIntegration/issues/
// @updateURL    https://github.com/Revadike/SteamWebIntegration/raw/master/Steam%20Web%20Integration.user.js
// @version      1.8.8
// ==/UserScript==
"use strict";

// ==Code==
// eslint-disable-next-line no-multi-assign
this.$ = this.jQuery = jQuery.noConflict(true);

const defaults = `{"prefix":false,"boxed":true,"wantIgnores":true,"wantDecommissioned":true,"wantLimited":true,"wantCards":true,"wantBundles":true,"ignoredIcon":"&#128683;&#xFE0E;","ignoredColor":"#808080","wishlistIcon":"&#10084;","wishlistColor":"#ff69b4","ownedIcon":"&#10004;","ownedColor":"#008000","unownedIcon":"&#10008;","unownedColor":"#ff0000","decommissionedIcon":"&#9760;","decommissionedColor":"#ffffff","limitedIcon":"&#9881;","limitedColor":"#00ffff","cardIcon":"&#x1F0A1","cardColor":"#0000ff","bundleIcon":"&#127873;&#xFE0E;","bundleColor":"#ffff00","userRefreshInterval":0,"decommissionedRefreshInterval":1440,"limitedRefreshInterval":2880,"cardsRefreshInterval":2880,"bundlesRefreshInterval":2880,"dateOverride":false}`;
const settings = JSON.parse(GM_getValue(`swi_settings`, defaults));
const settingsuri = `https://revadike.ga/swi/settings/`;

if (location.href.startsWith(settingsuri)) {
    unsafeWindow.onChange = onChange;
    unsafeWindow.scriptInfo = GM_info.script;
    window.onload = displaySettings;
}

GM_registerMenuCommand(`Change settings`, () => unsafeWindow.open(settingsuri, `_blank`));
refresh();

function displaySettings() {
    for (const name in settings) {
        const value = settings[name];
        if (typeof value === `boolean`) {
            $(`#${name}`).prop(`checked`, value);
        } else {
            $(`#${name}`).val(value);
        }
    }
}

function onChange(elem) {
    settings[elem.name] = elem.type === `checkbox` ? elem.checked : isFinite(elem.value) ? Number(elem.value) : elem.value;
    GM_setValue(`swi_settings`, JSON.stringify(settings));
    showToast();
}

function showToast() {
    $(`#snackbar`).addClass(`show`);
    setTimeout(() => $(`#snackbar`).removeClass(`show`), 3000);
}

function refresh() {
    const cachedJson = GM_getValue(`swi_data`, null);
    const lastCached = GM_getValue(`swi_last`, 0);

    if (cachedJson && Date.now() - lastCached < settings.userRefreshInterval * 60000) {
        refreshDecommissioned((decommissioned) => refreshLimited((limited) => refreshCards((cards) => refreshBundles((bundles) => init(JSON.parse(cachedJson), decommissioned, cards, bundles, limited)))));
        return;
    }

    const v = parseInt(GM_getValue(`swi_v`, `1`)) + 1;
    GM_xmlhttpRequest({
        "method": `GET`,
        "url": `https://store.steampowered.com/dynamicstore/userdata/?v=${v}`,
        "onload": (response) => {
            GM_setValue(`swi_v`, v);
            refreshDecommissioned((decommissioned) => refreshLimited((limited) => refreshCards((cards) => refreshBundles((bundles) => init(JSON.parse(response.responseText), decommissioned, cards, bundles, limited)))));
        }
    });
}

function init(userdata, decommissioned, cards, bundles, limited) {
    let ignoredApps = Object.keys(userdata.rgIgnoredApps).map((a) => parseInt(a, 10));
    let ownedApps = userdata.rgOwnedApps;
    let ownedPackages = userdata.rgOwnedPackages;
    let wishlist = userdata.rgWishlist;
    let lastCached = GM_getValue(`swi_last`, 0);

    if (ownedApps.length === 0 && ownedPackages.length === 0 && ignoredApps.length === 0 && wishlist.length === 0) {
        const parsedCachedJson = JSON.parse(GM_getValue(`swi_data`, null));
        ignoredApps = parsedCachedJson.rgIgnoredApps;
        ownedApps = parsedCachedJson.rgOwnedApps;
        ownedPackages = parsedCachedJson.rgOwnedPackages;
        wishlist = parsedCachedJson.rgWishlist;
    } else {
        lastCached = Date.now();
        GM_setValue(`swi_last`, lastCached);
        GM_setValue(`swi_data`, JSON.stringify(userdata));
    }

    const lcs = settings.dateOverride ? (new Date(lastCached)).toLocaleString(`sv-SE`) : (new Date(lastCached)).toLocaleString();
    const dlcs = (new Date(GM_getValue(`swi_decommissioned_last`, 0))).toLocaleString(settings.dateOverride ? `sv-SE` : undefined);
    const llcs = (new Date(GM_getValue(`swi_limited_last`, 0))).toLocaleString(settings.dateOverride ? `sv-SE` : undefined);
    const clcs = (new Date(GM_getValue(`swi_tradingcards_last`, 0))).toLocaleString(settings.dateOverride ? `sv-SE` : undefined);
    const blcs = (new Date(GM_getValue(`swi_bundles_last`, 0))).toLocaleString(settings.dateOverride ? `sv-SE` : undefined);

    const appSelector = [
        `[href*="steamcommunity.com/app/"]`,
        `[href*="steamdb.info/app/"]`,
        `[href*="store.steampowered.com/agecheck/app/"]`,
        `[href*="store.steampowered.com/app/"]`,
        `img[src*="cdn.akamai.steamstatic.com/steam/apps/"]`,
        `img[src*="cdn.edgecast.steamstatic.com/steam/apps/"]`,
        `img[src*="steamcdn-a.akamaihd.net/steam/apps/"]`,
        `img[src*="steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/"]`,
        `img[src*="steamcdn-a.opskins.media/steam/apps/"]`,
        `img[src*="steamcdn-a.opskins.media/steamcommunity/public/images/apps/"]`,
        `img[src*="steamdb.info/static/camo/apps/"]`
    ].map((s) => `${s}:not(.swi)`).join(`, `);

    const subSelector = [
        `[href*="steamdb.info/sub/"]`,
        `[href*="store.steampowered.com/sub/"]`
    ].map((s) => `${s}:not(.swi)`).join(`, `);

    let delaySWI;
    const doSWI = () => {
        if (delaySWI) {
            clearTimeout(delaySWI);
        }

        delaySWI = setTimeout(() => {
            console.log(`[Steam Web Integration] Executing`);
            clearTimeout(delaySWI);
            $(appSelector).get().forEach((elem) => doApp(elem, wishlist, ownedApps, ignoredApps, decommissioned, limited, cards, bundles, lcs, dlcs, llcs, clcs, blcs));
            $(subSelector).get().forEach((elem) => doSub(elem, ownedPackages, lcs), 0);
        }, 300);
    };

    const clearSWI = () => {
        console.log(`[Steam Web Integration] Clearing`);
        $(`.swi-block`).remove();
        $(`.swi`).removeClass(`swi`);
    };

    const reloadSWI = () => {
        clearSWI();
        doSWI();
    };

    $(document).ready(() => {
        doSWI();
        $(document).observe(`added`, appSelector, doSWI);
        $(document).observe(`added`, subSelector, doSWI);

        GM_registerMenuCommand(`Run again`, doSWI);
        GM_registerMenuCommand(`Clear all`, clearSWI);
        GM_registerMenuCommand(`Clear and run (reload)`, reloadSWI);

        unsafeWindow.doSWI = doSWI;
        unsafeWindow.clearSWI = clearSWI;
        unsafeWindow.reloadSWI = reloadSWI;
    });
}

function refreshDecommissioned(callback) {
    if (!settings.wantDecommissioned) {
        callback();
        return;
    }

    const cachedDecommissioned = JSON.parse(GM_getValue(`swi_decommissioned`, null));
    const lastCachedDecommissioned = GM_getValue(`swi_decommissioned_last`, 0);
    if (cachedDecommissioned && Date.now() - lastCachedDecommissioned < settings.decommissionedRefreshInterval * 60000) {
        callback(cachedDecommissioned);
        return;
    }

    GM_xmlhttpRequest({
        "method": `GET`,
        "url": `https://steam-tracker.com/api?action=GetAppListV3`,
        "timeout": 30000,
        "onload": (response) => {
            console.log(response);
            let json = null;
            try {
                json = JSON.parse(response.responseText);
                if (json.success) {
                    GM_setValue(`swi_decommissioned`, JSON.stringify(json.removed_apps));
                    GM_setValue(`swi_decommissioned_last`, Date.now());
                }
                callback(json.removed_apps);
                return;
            } catch (e) {
                console.log(`Unable to parse removed steam games data. Using cached data...`, e);
                callback(cachedDecommissioned);
                return;
            }
        },
        "onerror": () => {
            console.log(`An error occurred while refreshing removed steam games data. Using cached data...`);
            callback(cachedDecommissioned);
        },
        "ontimeout": () => {
            console.log(`It took too long to refresh removed steam games data. Using cached data...`);
            callback(cachedDecommissioned);
        }
    });
}

function refreshLimited(callback) {
    if (!settings.wantLimited) {
        callback();
        return;
    }

    const cachedLimited = JSON.parse(GM_getValue(`swi_limited`, null));
    const lastCachedLimited = parseInt(GM_getValue(`swi_limited_last`, 0)) || 1;
    if (cachedLimited && Object.keys(cachedLimited).length > 7000 && Date.now() - lastCachedLimited < settings.limitedRefreshInterval * 60000) {
        callback(cachedLimited);
        return;
    }

    GM_xmlhttpRequest({
        "method": `GET`,
        "url": `https://bartervg.com/browse/tag/481/json/`,
        "timeout": 30000,
        "onload": (response) => {
            let json = null;
            try {
                json = JSON.parse(response.responseText);
                if (Object.keys(json).length > 7000) { // sanity check
                    GM_setValue(`swi_limited`, JSON.stringify(json));
                    GM_setValue(`swi_limited_last`, Date.now());
                }
                callback(json);
                return;
            } catch (error) {
                console.log(`Unable to parse Barter.vg low confidence metric data. Using cached data...`, error);
                callback(cachedLimited);
                return;
            }
        },
        "onerror": (response) => {
            console.log(`An error occurred while refreshing Barter.vg low confidence metric data. Using cached data...`, response);
            callback(cachedLimited);
        },
        "ontimeout": () => {
            console.log(`It took too long to refresh Barter.vg low confidence metric data. Using cached data...`);
            callback(cachedLimited);
        }
    });
}

function refreshCards(callback) {
    if (!settings.wantCards) {
        callback();
        return;
    }

    const cachedCards = JSON.parse(GM_getValue(`swi_tradingcards`, null));
    const lastCachedCards = parseInt(GM_getValue(`swi_tradingcards_last`, 0)) || 1;
    if (cachedCards && Object.keys(cachedCards).length > 7000 && Object.values(cachedCards)[0].marketable && Date.now() - lastCachedCards < settings.cardsRefreshInterval * 60000) {
        callback(cachedCards);
        return;
    }

    GM_xmlhttpRequest({
        "method": `GET`,
        "url": `https://bartervg.com/browse/cards/json/`,
        "timeout": 30000,
        "onload": (response) => {
            let json = null;
            try {
                json = JSON.parse(response.responseText);
                if (Object.keys(json).length > 7000) { // sanity check
                    GM_setValue(`swi_tradingcards`, JSON.stringify(json));
                    GM_setValue(`swi_tradingcards_last`, Date.now());
                }
                callback(json);
                return;
            } catch (error) {
                console.log(`Unable to parse Barter.vg trading cards data. Using cached data...`, error);
                callback(cachedCards);
                return;
            }
        },
        "onerror": (response) => {
            console.log(`An error occurred while refreshing Barter.vg trading cards data. Using cached data...`, response);
            callback(cachedCards);
        },
        "ontimeout": () => {
            console.log(`It took too long to refresh Barter.vg trading cards data. Using cached data...`);
            callback(cachedCards);
        }
    });
}

function refreshBundles(callback) {
    if (!settings.wantBundles) {
        callback();
        return;
    }

    const cachedBundles = JSON.parse(GM_getValue(`swi_bundles`, null));
    const lastCachedBundles = parseInt(GM_getValue(`swi_bundles_last`, 0)) || 1;
    if (cachedBundles && Object.keys(cachedBundles).length > 7000 && Object.values(cachedBundles)[0].bundles && Date.now() - lastCachedBundles < settings.bundlesRefreshInterval * 60000) {
        callback(cachedBundles);
        return;
    }

    GM_xmlhttpRequest({
        "method": `GET`,
        "url": `https://bartervg.com/browse/bundles/json/`,
        "timeout": 30000,
        "onload": (response) => {
            let json = null;
            try {
                json = JSON.parse(response.responseText);
                if (Object.keys(json).length > 7000) { // sanity check
                    GM_setValue(`swi_bundles`, JSON.stringify(json));
                    GM_setValue(`swi_bundles_last`, Date.now());
                }
                callback(json);
                return;
            } catch (error) {
                console.log(`Unable to parse Barter.vg bundles data. Using cached data...`, error);
                callback(cachedBundles);
                return;
            }
        },
        "onerror": (response) => {
            console.log(`An error occurred while refreshing Barter.vg bundles data. Using cached data...`, response);
            callback(cachedBundles);
        },
        "ontimeout": () => {
            console.log(`It took too long to refresh Barter.vg bundles data. Using cached data...`);
            callback(cachedBundles);
        }
    });
}

function doApp(elem, wishlist, ownedApps, ignoredApps, decommissioned, limited, cards, bundles, lcs, dlcs, llcs, clcs, blcs) {
    $(elem).addClass(`swi`);
    const appID = elem.href ? parseInt(stripURI(elem.href.split(`app/`)[1])) : parseInt(stripURI(elem.src.split(`apps/`)[1]));
    if (isNaN(appID)) {
        return;
    }

    setTimeout(() => {
        let html;

        if (ownedApps.includes(appID)) { // if owned
            html = genIconHTML(settings.ownedColor, `Game or DLC (${appID}) owned`, lcs, settings.ownedIcon); // ✔
        } else if (wishlist.includes(appID)) { // if not owned and wishlisted
            html = genIconHTML(settings.wishlistColor, `Game or DLC (${appID}) wishlisted`, lcs, settings.wishlistIcon); // ❤
        } else { // else not owned and not wishlisted
            html = genIconHTML(settings.unownedColor, `Game or DLC (${appID}) not owned`, lcs, settings.unownedIcon); // ✘
        }

        if (settings.wantIgnores && ignoredApps.includes(appID)) { // if ignored and enabled
            html += genIconHTML(settings.ignoredColor, `Game or DLC (${appID}) ignored`, lcs, settings.ignoredIcon); // 🛇
        }

        if (settings.wantDecommissioned && decommissioned) { // if decommissioned and have cache or new data
            const app = decommissioned.find((obj) => obj.appid === appID.toString());
            if (app) { // if decommissioned?
                html += genIconHTML(settings.decommissionedColor, `The ${app.type} '${app.name.replace(/"|'/g, ``)}' (${appID}) is ${app.category.toLowerCase()} and has only ${app.count} confirmed owner${app.count === 1 ? `` : `s`} on Steam`, dlcs, settings.decommissionedIcon, `https://steam-tracker.com/app/${appID}/`); // 🗑
            }
        }

        if (settings.wantLimited && limited[appID]) { // if is limited
            html += genIconHTML(settings.limitedColor, `Game (${appID}) has profile features limited`, llcs, settings.limitedIcon); // ⚙
        }

        if (settings.wantCards && cards[appID] && cards[appID].cards && cards[appID].cards > 0) { // if has cards and enabled
            html += genIconHTML(settings.cardColor, `Game (${appID}) has ${cards[appID].cards} ${cards[appID].marketable ? `` : `un`}marketable card${cards[appID].cards === 1 ? `` : `s`}`, clcs, settings.cardIcon, `https://www.steamcardexchange.net/index.php?gamepage-appid-${appID}`);
        }

        if (settings.wantBundles && bundles[appID] && bundles[appID].bundles && bundles[appID].bundles > 0) { // if is bundled and enabled
            html += genIconHTML(settings.bundleColor, `Game (${appID}) has been in ${bundles[appID].bundles} bundle${bundles[appID].bundles === 1 ? `` : `s`}`, blcs, settings.bundleIcon, `https://barter.vg/steam/app/${appID}/#bundles`);
        }

        if (settings.prefix) {
            $(elem).before(genBoxHTML(html, appID));
        } else {
            $(elem).after(genBoxHTML(html, appID));
        }

        $(elem).parent().css(`overflow`, `visible`);
    }, 0);
}

function doSub(elem, ownedPackages, lcs) {
    $(elem).addClass(`swi`);
    const subID = parseInt(stripURI(elem.href.split(`sub/`)[1]));
    if (isNaN(subID)) {
        return;
    }

    setTimeout(() => {
        let html;

        if (ownedPackages.includes(subID)) { // if owned
            html = genIconHTML(settings.ownedColor, `Package (${subID}) owned`, lcs, settings.ownedIcon); // ✔
        } else { // else not owned
            html = genIconHTML(settings.unownedColor, `Package (${subID}) not owned`, lcs, settings.unownedIcon); // ✖
        }

        if (settings.prefix) {
            $(elem).before(genBoxHTML(html, undefined, subID));
        } else {
            $(elem).after(genBoxHTML(html, undefined, subID));
        }

        $(elem).parent().css(`overflow`, `visible`);
    }, 0);
}

function stripURI(uri) {
    return uri.split(`/`)[0].split(`?`)[0].split(`#`)[0];
}

function genIconHTML(color, str, lcs, icon, link) {
    const { name, version, author } = GM_info.script;
    const titlePlus = `\nLast updated at ${lcs}\n${name} (${version}) by ${author}`;
    if (link) {
        return `<span style="margin: 2px; cursor: help;" title="${str}\n${titlePlus}"> <a style="color: ${color} !important; text-decoration: none;" href="${link}" target="_blank">${icon}</a></span>`;
    }

    return `<span style="margin: 2px; color: ${color} !important; cursor: help;" title="${str} on Steam\n${titlePlus}"> ${icon}</span>`;
}

function genBoxHTML(html, appID, subID) {
    const data = subID ? `subid="${subID}"` : `appid="${appID}"`;
    const style = settings.boxed ? ` position: relative; padding: 2px 4px 2px 4px; margin: auto 4px auto 4px; border-radius: 5px; background: rgba(0, 0, 0, 0.7);` : ``;
    return `<div class="swi-block" data-${data} style="display: inline-block; line-height: initial;${style}">${html}</div>`;
}
// ==/Code==