// ==UserScript==
// @name         Crunchyroll Full Sync to MAL
// @namespace    https://rias.zone/anime
// @version      2.0
// @description  Sync all Crunchyroll anime (watched or dropped) to MAL accurately
// @author       Rias
// @match        https://www.crunchyroll.com/*
// @grant        GM_xmlhttpRequest
// @connect      api.myanimelist.net
// ==/UserScript==

(function () {
    'use strict';

    const MAL_TOKEN = 'YOUR_MAL_ACCESS_TOKEN_HERE';

    function getAnimeProgressFromQueue() {
        const items = document.querySelectorAll('[data-testid="queue-item-card"]');
        const animeList = [];

        items.forEach(card => {
            const title = card.querySelector('[data-testid="queue-item-card-title"]').textContent.trim();
            const progressText = card.querySelector('[data-testid="queue-item-card-progress"]').textContent.trim();
            let episodeWatched = 0;

            const match = progressText.match(/Episode\s(\d+)/i);
            if (match) episodeWatched = parseInt(match[1]);

            animeList.push({ title, episodeWatched });
        });

        return animeList;
    }

    function searchMAL(title, callback) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: `https://api.myanimelist.net/v2/anime?q=${encodeURIComponent(title)}&limit=1`,
            headers: {
                'Authorization': `Bearer ${MAL_TOKEN}`
            },
            onload: function (response) {
                try {
                    const json = JSON.parse(response.responseText);
                    if (json.data && json.data.length > 0) {
                        const anime = json.data[0].node;
                        callback(anime.id, anime.num_episodes || null);
                    } else {
                        console.warn(`❌ MAL not found for ${title}`);
                    }
                } catch (err) {
                    console.error("MAL search failed", err);
                }
            }
        });
    }

    function updateMAL(animeId, epWatched, totalEps) {
        let status = 'watching';
        if (epWatched === 0) status = 'plan_to_watch';
        else if (totalEps && epWatched >= totalEps) status = 'completed';
        else if (epWatched === 1) status = 'dropped';
        else status = 'watching';

        const data = `status=${status}&num_watched_episodes=${epWatched}`;

        GM_xmlhttpRequest({
            method: 'PATCH',
            url: `https://api.myanimelist.net/v2/anime/${animeId}/my_list_status`,
            headers: {
                'Authorization': `Bearer ${MAL_TOKEN}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            data: data,
            onload: function (response) {
                if (response.status === 200) {
                    console.log(`✅ Synced ${animeId} [${status} - Ep ${epWatched}]`);
                } else {
                    console.error(`❌ Failed to sync MAL ${animeId}`, response.responseText);
                }
            }
        });
    }

    function sync() {
        const list = getAnimeProgressFromQueue();
        list.forEach((anime, i) => {
            setTimeout(() => {
                searchMAL(anime.title, (malId, totalEps) => {
                    updateMAL(malId, anime.episodeWatched, totalEps);
                });
            }, i * 2000); // wait to avoid rate limits
        });
    }

    function addSyncBtn() {
        const btn = document.createElement('button');
        btn.innerText = "🔁 Sync CR to MAL";
        btn.style = "position:fixed;top:100px;right:20px;z-index:9999;padding:10px;background:#24292e;color:#fff;border:none;border-radius:6px;";
        btn.onclick = sync;
        document.body.appendChild(btn);
    }

    window.addEventListener('load', () => setTimeout(addSyncBtn, 3000));
})();
