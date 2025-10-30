// ==UserScript==
// @name         Bugs Tracklist Extractor
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Extracts album info, track list, artists, and durations from Bugs.co.kr
// @author       Me
// @match        https://music.bugs.co.kr/album/*
// @grant        GM_addStyle
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';


    function fn_CalculateSeparator(artistIndex, artistCount) {
        if (artistIndex == artistCount){
            return '';
        } else if (artistIndex == artistCount - 1){
            return ' & ';
        } else {
            return ', ';
        }
    }

    /**
     * Main function to extract album and track data.
     */
    function extractData() {
        let mbReleaseObj = {
            // Set release status to official
            status: 'official',
            // Set release packaging to none since it is a digital release
            packaging: 'none',
            artist_credit: [],
            labels: [],
            discs: []
        };

        // Get Release Title
        let titleEl = document.querySelector('header.sectionPadding.pgTitle.noneLNB > div.innerContainer > h1');
        mbReleaseObj.title = titleEl ? titleEl.textContent.trim() : 'Unknown';

        // Get Release URL
        const bugsUrlRegexPattern = /https?:\/\/music\.bugs\.co\.kr\/album\/\d+/g;
        const bugsReleaseUrl = window.location.href.match(bugsUrlRegexPattern)[0];
        mbReleaseObj.urls = [
            {url: bugsReleaseUrl, link_type: 74 }, //purchase for download
            {url: bugsReleaseUrl, link_type: 980 } //streaming
        ];

        // Get Album Summary Info
        let releaseInfoEl = document.querySelector('section.sectionPadding.summaryInfo.summaryAlbum > div.innerContainer > div.basicInfo > table.info > tbody');

            for (const tblrowEl of releaseInfoEl.querySelectorAll('tr')) {
                let tblrowtypeEl = tblrowEl.querySelector('th')

                // Release Artist
                if (tblrowtypeEl.textContent.trim() == '아티스트') {
                    let artistsArr = tblrowEl.querySelectorAll('td > a').length > 0 ? tblrowEl.querySelectorAll('td > a') : tblrowEl.querySelectorAll('td');
                    artistsArr.forEach( function (artistEl, artistIndex){
                        let ac = {
                            artist_name: artistEl.textContent.trim(),
                            credited_name: artistEl.textContent.trim(),
                            joinphrase: fn_CalculateSeparator(artistIndex + 1, artistsArr.length),
                            //mbid: MBIDfromUrl(artist.resource_url, 'artist'),
                        }
                        mbReleaseObj.artist_credit.push(ac);
                    });
                }

                // Release Type
                else if (tblrowtypeEl.textContent.trim() == '유형') {
                    let release_type = tblrowEl.querySelector('td').textContent.trim();
                    if (release_type == '컴필레이션') {
                        mbReleaseObj.secondary_types = ['compilation'];
                    }
                    if (release_type == 'OST') {
                        mbReleaseObj.secondary_types = ['soundtrack'];
                    }
                    if (release_type == '정규') {
                        mbReleaseObj.type = 'album';
                    }
                    if (release_type == '싱글') {
                        mbReleaseObj.type = 'single';
                    }
                    if (release_type == 'EP(미니)') {
                        mbReleaseObj.type = 'ep';
                    }
                }

                // Release Date
                else if (tblrowtypeEl.textContent.trim() == '발매일') {
                    let release_date = tblrowEl.querySelector('td > time').getAttribute('datetime').trim().split('.');
                    mbReleaseObj.year = parseInt(release_date[0], 10);
                    mbReleaseObj.month = parseInt(release_date[1], 10);
                    mbReleaseObj.day = parseInt(release_date[2], 10);
                }
                // Labels
                else if (['유통사', '기획사'].includes(tblrowtypeEl.textContent.trim())) {
                    let label = {
                        name: tblrowEl.querySelector('td').textContent.trim(),
                    };
                    mbReleaseObj.labels.push(label);
                }
            }

        // Get discs (mediums)
        let mediumList = document.querySelectorAll('table.list.trackList.byAlbum > tbody');
        mediumList.forEach(mediumEl => {
            let medium = {
                format: 'digital media',
                tracks: [],
            };

            // Get Tracks (수록곡)
            let trackList = mediumEl.querySelectorAll('tr');
            trackList.forEach(trackEl => {
                // Skip rows that are not track info (e.g., "disc 1" headers)
                if (trackEl.classList.contains('cd')) {
                    return;
                }

                var track = {
                    artist_credit: [],
                    duration: '?:??',
                };

                // Get Track Number (번호)
                let indexEl = trackEl.querySelector('td > p.trackIndex');
                track.number = indexEl ? parseInt(indexEl.textContent.trim(), 10) : null;

                // Get Track Name (곡)
                let titleEl = trackEl.querySelector('th > p.title > a');
                track.title = titleEl ? titleEl.getAttribute('title').trim() : 'Unknown';

                // Get Track Artists (아티스트)
                let track_artists = [];
                // Get main artist
                let mainartistEl = trackEl.querySelector('td.left > p.artist > a');
                let artist = mainartistEl ? mainartistEl.getAttribute('title').trim() : 'Unknown';
                track_artists.push(artist);

                // Get additional artists, if they exist
                let multiartistEl = trackEl.querySelector('td.left > p.artist > a.more');
                let multiartistStr = multiartistEl ? multiartistEl.getAttribute('onclick').replaceAll("\\\\n", "") : 'Unknown';
                    if (multiartistStr !== 'Unknown') {
                        let multiartistArr = multiartistStr.match(/(?<=\|\|OK)[^\|]+(?=\|\|)/g);
                        multiartistArr.forEach(artist=> {
                            track_artists.push(artist);
                        })
                    };

                track_artists.forEach( function (artistName, artistIndex){
                    let ac = {
                        artist_name: artistName,
                        credited_name: artistName,
                        joinphrase: fn_CalculateSeparator(artistIndex + 1, track_artists.length),
                        //mbid: MBIDfromUrl(artist.resource_url, 'artist'),
                    }
                    track.artist_credit.push(ac);
                });

                // Get Track Duration (Track length)
                // let trackinfoEl = trackEl.querySelector('td > a.trackInfo');
                // let popup = window.open(trackinfoEl.getAttribute('href'), '_blank');
                // popup.onload = (ev) => {
                //     let lengthEl = popup.document.querySelector('table.info > tbody > tr > td > time');
                //     track.duration = lengthEl ? lengthEl.getAttribute('datetime').trim() : '??:??';
                //     setTimeout(()=>{
                //         popup.close();
                //     }, 2500)
                // };
                // let lengthEl = popup.document.querySelector('table.info > tbody > tr > td > time');
                // track.length = lengthEl ? lengthEl.getAttribute('datetime').trim() : '??:??';

                // Add the track object to our array if it's a valid track
                if (track.name !== 'Unknown' && track.index !== null) {
                     medium.tracks.push(track);
                };
            });

            mbReleaseObj.discs.push(medium);

        });

        // 3. Format as JSON and copy to clipboard
        let jsonData = JSON.stringify(mbReleaseObj, null, 2); // null, 2 formats the JSON nicely
        GM_setClipboard(jsonData);

        // 4. Notify user
        var trackcount = 0;
        mbReleaseObj.discs.forEach(mediumObj => {
            trackcount += mediumObj.tracks.length
        });
        alert(`Successfully extracted "${mbReleaseObj.title}". ${trackcount} track(s) over ${mbReleaseObj.discs.length} medium(s)".\n\nJSON data has been copied to your clipboard!`);
        console.log("--- Bugs.co.kr Extracted Data ---");
        console.log(jsonData);
    }

    /**
     * Creates and injects the "Extract" button onto the page.
     */
    function addButton() {
        let btn = document.createElement('button');
        btn.innerHTML = 'Import to MusicBrainz';
        btn.id = 'gemini-extract-btn-bugs';
        btn.addEventListener('click', extractData);
        document.body.appendChild(btn);
    }

    // 3. Add styling for the button
    GM_addStyle(`
        #gemini-extract-btn-bugs {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            padding: 10px 15px;
            background-color: #FF3B30; /* Bugs.co.kr brand color */
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            transition: background-color 0.2s, transform 0.2s;
        }
        #gemini-extract-btn-bugs:hover {
            background-color: #E0302A;
            transform: translateY(-2px);
        }
    `);

    // Run the script once the page is loaded
    window.addEventListener('load', addButton);

})();
