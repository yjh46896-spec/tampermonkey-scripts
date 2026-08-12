// ==UserScript==
// @name         SOOP 실시간 댓글 인기순 & 차트 뷰어
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  SOOP 게시글에서 실시간 댓글 랭킹과 변화 추이 차트를 봅니다.
// @match        *://*.sooplive.co.kr/*
// @match        *://*.sooplive.com/*
// @require      https://cdn.jsdelivr.net/npm/chart.js
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      chapi.sooplive.co.kr
// ==/UserScript==
// @updateURL    https://raw.githubusercontent.com/yjh46896-spec/tampermonkey-scripts/main/soop-comment-rank.user.js
// @downloadURL  https://raw.githubusercontent.com/yjh46896-spec/tampermonkey-scripts/main/soop-comment-rank.user.js

(function() {
    'use strict';

    // 현재 페이지가 게시글(공지사항 포함)인지 확인하는 정규식
    function getPostInfo(url) {
        let m = url.match(/\/station\/([^/]+)\/post\/(\d+)/);
        if (m) return { station: m[1], post: m[2] };
        m = url.match(/ch\.sooplive\.(?:co\.kr|com)\/([^/]+)\/post\/(\d+)/);
        if (m) return { station: m[1], post: m[2] };
        m = url.match(/\/([^/]+)\/post\/(\d+)/);
        if (m && !m[1].includes("station")) return { station: m[1], post: m[2] };
        return null;
    }

    // 주소가 변경될 때마다 UI를 띄울지 숨길지 결정
    function checkUrlAndInit() {
        const info = getPostInfo(window.location.href);
        
        if (info) {
            // UI가 돔(DOM)에서 날아갔다면 다시 주입
            if (!document.getElementById('sr-open-btn')) {
                injectUI();
            }
            
            // 버튼 표시
            const btn = document.getElementById('sr-open-btn');
            if (btn) btn.style.display = 'block';
            
            // 모달 안의 URL 입력창 자동 업데이트
            const urlInput = document.getElementById('url');
            if (urlInput && urlInput.value !== window.location.href) {
                urlInput.value = window.location.href;
            }
        } else {
            // 게시글 화면이 아니면 숨김
            const btn = document.getElementById('sr-open-btn');
            if (btn) btn.style.display = 'none';
            const overlay = document.getElementById('soop-rank-overlay');
            if (overlay) overlay.style.display = 'none';
            document.body.style.overflow = '';
        }
    }

    // 1. History API 감지 (클릭으로 페이지 이동 시 즉각 반응)
    const originalPushState = history.pushState;
    history.pushState = function() {
        originalPushState.apply(this, arguments);
        setTimeout(checkUrlAndInit, 200);
    };
    const originalReplaceState = history.replaceState;
    history.replaceState = function() {
        originalReplaceState.apply(this, arguments);
        setTimeout(checkUrlAndInit, 200);
    };
    window.addEventListener('popstate', () => setTimeout(checkUrlAndInit, 200));

    // 2. 주기적 URL 감지 (뒤로가기 등 놓치는 엣지 케이스 방어)
    let lastUrl = location.href;
    setInterval(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            checkUrlAndInit();
        } else if (getPostInfo(location.href) && !document.getElementById('sr-open-btn')) {
            // 게시글 화면인데 사이트 자체 렌더링으로 버튼이 사라진 경우 복구
            checkUrlAndInit();
        }
    }, 500);

    // 초기 실행
    checkUrlAndInit();

    function injectUI() {
        GM_addStyle(`
            #soop-rank-overlay {
                --bg: #0b0d11; --panel: #161a22; --panel-hover: #1e242f; --line: #2a313e;
                --text: #e2e8f0; --text-muted: #94a3b8; --accent: #4f46e5; --accent-hover: #6366f1;
                --up-color: #ef4444; --down-color: #3b82f6; --same-color: #10b981;
                
                position: fixed; inset: 0; z-index: 9999999;
                background: var(--bg); color: var(--text);
                font-family: 'Pretendard Variable', Pretendard, -apple-system, sans-serif;
                overflow-y: scroll; display: none; padding-bottom: 80px;
            }
            #soop-rank-overlay * { box-sizing: border-box; }
            #soop-rank-overlay ::-webkit-scrollbar { width: 8px; height: 8px; }
            #soop-rank-overlay ::-webkit-scrollbar-track { background: transparent; }
            #soop-rank-overlay ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
            #soop-rank-overlay ::-webkit-scrollbar-thumb:hover { background: #475569; }

            .sr-wrap { max-width: 1000px; margin: auto; padding: 24px 20px; transition: max-width 0.4s; }
            .sr-wrap.wide { max-width: 1640px; }
            .sr-wrap.wide-no-chart { max-width: 1240px; }

            .sr-top-controls { background: var(--panel); padding: 20px; border-radius: 16px; border: 1px solid var(--line); margin-bottom: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); }
            .sr-top-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
            .sr-top-left { display: flex; align-items: center; gap: 12px; }
            .sr-bottom-row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }

            #soop-rank-overlay h1 { font-size: 22px; margin: 0; font-weight: 800; color: #fff; }
            #soop-rank-overlay input, #soop-rank-overlay select { height: 42px; border-radius: 10px; border: 1px solid var(--line); background: #0f1218; color: var(--text); padding: 0 14px; font-size: 14px; }
            #soop-rank-overlay input:focus, #soop-rank-overlay select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.2); }

            .sr-deadline-wrapper { display: flex; align-items: center; gap: 8px; background: #0f1218; border: 1px solid var(--line); border-radius: 10px; padding: 0 14px; height: 42px; }
            .sr-deadline-wrapper input[type="datetime-local"] { border:none; padding:0; height:auto; background:transparent; font-weight:600; color:var(--text); }
            .sr-deadline-wrapper input::-webkit-calendar-picker-indicator { filter: invert(0.8); cursor: pointer; }

            #soop-rank-overlay button.sr-btn { height: 42px; border: 0; border-radius: 10px; background: var(--accent); color: #fff; font-weight: 700; font-size: 14px; padding: 0 20px; cursor: pointer; transition: 0.2s; }
            #soop-rank-overlay button.sr-btn:hover { background: var(--accent-hover); transform: translateY(-1px); }
            #soop-rank-overlay button.sr-btn.secondary { background: #334155; }
            #soop-rank-overlay button.sr-btn.secondary:hover { background: #475569; }
            #soop-rank-overlay button.sr-btn.close-ui { background: var(--danger); }
            #soop-rank-overlay button.sr-btn.close-ui:hover { background: #b91c1c; }

            .sr-status { font-size: 13px; color: var(--text-muted); font-weight: 500; margin-left: auto; }
            .sr-notice-box { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: rgba(15, 18, 24, 0.85); backdrop-filter: blur(8px); border: 1px solid rgba(99, 102, 241, 0.4); color: #818cf8; padding: 12px 28px; border-radius: 30px; text-align: center; font-weight: 700; font-size: 14px; box-shadow: 0 8px 30px rgba(0,0,0,0.5); z-index: 990; pointer-events: none; }

            .sr-layout-grid { display: grid; grid-template-columns: 1fr; gap: 24px; transition: all 0.4s; }
            .sr-layout-grid.show-panels { grid-template-columns: 380px 1fr 400px; }
            .sr-layout-grid.show-panels.no-chart { grid-template-columns: 1fr 420px; }
            .sr-side-col { display: none; }
            .sr-layout-grid.show-panels .sr-side-col { display: block; }
            .sr-layout-grid.show-panels.no-chart .sr-left-col { display: none; }

            .sr-panel { background: var(--panel); border: 1px solid var(--line); border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
            .sr-head { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--line); flex-wrap: wrap; gap: 12px; background: rgba(255,255,255,0.02); }
            .sr-title { font-weight: 800; font-size: 16px; }
            .sr-sub { font-size: 12px; color: var(--text-muted); margin-top: 4px; }

            .sr-head-actions { display: flex; align-items: center; gap: 16px; font-size: 13px; color: var(--text-muted); font-weight: 500; }
            .sr-inline-setting { display: flex; align-items: center; gap: 8px; }
            .sr-inline-setting input[type="number"] { width: 44px; height: 28px; text-align: center; padding: 0; font-size: 13px; }
            .sr-toggle-switch { position: relative; display: inline-block; width: 38px; height: 22px; margin-top: 2px; }
            .sr-toggle-switch input { opacity: 0; width: 0; height: 0; }
            .sr-slider { position: absolute; cursor: pointer; inset: 0; background-color: #334155; transition: .3s; border-radius: 22px; }
            .sr-slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background-color: #cbd5e1; transition: .3s; border-radius: 50%; }
            .sr-toggle-switch input:checked + .sr-slider { background-color: var(--accent); }
            .sr-toggle-switch input:checked + .sr-slider:before { transform: translateX(16px); background-color: #fff; }

            .sr-panel-scroll { max-height: calc(100vh - 220px); overflow-y: auto; padding: 10px; flex: 1; }

            .sr-rankrow { display: grid; grid-template-columns: 44px 46px 1fr 110px; gap: 12px; align-items: center; padding: 14px 12px; margin-bottom: 6px; border-radius: 12px; background: rgba(255,255,255,0.015); transition: 0.2s; }
            .sr-rankrow:hover { background: var(--panel-hover); border: 1px solid var(--line); transform: translateY(-1px); }
            .sr-rankrow.topn { background: rgba(30, 41, 59, 0.4); border: 1px solid #334155; }
            .sr-rankrow.top1 { background: rgba(251, 191, 36, 0.08)!important; border: 1px solid rgba(251, 191, 36, 0.3)!important; box-shadow: inset 4px 0 #fbbf24; }
            .sr-rankrow.top2 { background: rgba(203, 213, 225, 0.06)!important; border: 1px solid rgba(203, 213, 225, 0.2)!important; box-shadow: inset 4px 0 #cbd5e1; }
            .sr-rankrow.top3 { background: rgba(180, 83, 9, 0.08)!important; border: 1px solid rgba(180, 83, 9, 0.3)!important; box-shadow: inset 4px 0 #b45309; }

            .sr-rank-col { display: flex; flex-direction: column; align-items: center; justify-content: center; }
            .sr-no { text-align: center; color: #94a3b8; font-weight: 900; font-size: 15px; }
            .top1 .sr-no { color: #fbbf24; } .top2 .sr-no { color: #cbd5e1; } .top3 .sr-no { color: #f59e0b; }
            .sr-rank-diff { font-size: 11px; font-weight: 800; margin-top: 5px; }
            .sr-up { color: var(--up-color); } .sr-down { color: var(--down-color); } .sr-same { color: var(--same-color); }

            .sr-avatar { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; background: #1e293b; border: 1px solid #334155; cursor: pointer; transition: 0.2s; }
            .sr-avatar:hover { opacity: 0.85; box-shadow: 0 0 0 2px var(--accent-hover); transform: scale(1.05); }
            .sr-nick { font-weight: 700; font-size: 15px; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
            .sr-nick:hover { color: var(--accent-hover); text-decoration: underline; }
            .sr-num { text-align: right; font-weight: 800; font-size: 15px; cursor: pointer; padding: 6px 8px; border-radius: 8px; transition: 0.2s; }
            .sr-num:hover { background: rgba(99, 102, 241, 0.15); color: #c7d2fe; }

            .sr-pin-btn { background: none; border: none; padding: 0 4px 0 0; cursor: pointer; color: var(--text-muted); font-size: 16px; transition: 0.2s; }
            .sr-pin-btn:hover { color: #cbd5e1; transform: scale(1.2); }
            .sr-pin-btn.active { color: #fbbf24; }

            .sr-empty { text-align: center; color: var(--text-muted); padding: 60px 20px; font-weight: 500; }
            .sr-searchbox { flex: 0 1 240px; }
            
            .sr-search-result { display: none; margin-bottom: 20px; background: var(--panel); border: 1px solid var(--line); border-radius: 16px; }
            .sr-search-card { display: grid; grid-template-columns: 50px 1fr auto; gap: 14px; align-items: center; padding: 16px; border-bottom: 1px solid var(--line); cursor: pointer; }
            .sr-search-card:hover { background: var(--panel-hover); }

            .sr-user-comment { padding: 14px 16px; border-bottom: 1px solid #1e293b; }
            .sr-uc-head { display: flex; gap: 10px; align-items: center; }
            .sr-uc-avatar { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; background: #1e293b; border: 1px solid #334155; }
            .sr-uc-top { display: flex; justify-content: space-between; align-items: center; flex: 1; color: var(--text-muted); font-size: 13px; font-weight: 500; }
            .sr-uc-top a { color: var(--text-muted); text-decoration: none; }
            .sr-uc-top a:hover { color: #818cf8; text-decoration: underline; }
            .sr-uc-like { font-weight: 800; color: #f1f5f9; }
            .sr-uc-text { margin-top: 10px; white-space: pre-wrap; word-break: break-word; line-height: 1.6; font-size: 15px; color: #e2e8f0; }
            .sr-uc-img { display: block; max-width: 100%; max-height: 400px; object-fit: contain; border-radius: 8px; cursor: zoom-in; margin: 10px 0; border: 1px solid var(--line); }

            .sr-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(4px); display: none; align-items: center; justify-content: center; padding: 20px; z-index: 9999999; }
            .sr-modal { width: min(1200px, 95vw); height: 85vh; background: var(--panel); border: 1px solid var(--line); border-radius: 20px; display: flex; flex-direction: column; box-shadow: 0 25px 80px rgba(0,0,0,0.5); }
            .sr-modal-head { display: flex; justify-content: space-between; align-items: center; padding: 18px 24px; border-bottom: 1px solid var(--line); background: rgba(255,255,255,0.02); }
            .sr-modal-split { display: grid; grid-template-columns: 380px 1fr; flex: 1; min-height: 0; }
            .sr-modal-split.no-chart { display: block; }
            .sr-modal-split.no-chart .sr-split-left { display: none; }
            .sr-split-left { border-right: 1px solid var(--line); display: flex; flex-direction: column; }
            .sr-split-right { overflow-y: auto; }

            .sr-chart-container { display: flex; flex-direction: column; gap: 20px; padding: 20px; flex: 1; overflow-y: auto; }
            .sr-chart-box { flex: 1; position: relative; min-height: 220px; background: rgba(0,0,0,0.1); border: 1px solid var(--line); border-radius: 12px; padding: 12px; }
            .sr-chart-title { font-size: 13px; font-weight: 700; color: #cbd5e1; margin-bottom: 8px; }

            /* 화면 여는 플로팅 버튼 */
            #sr-open-btn {
                position: fixed; bottom: 30px; right: 30px; z-index: 99999;
                background: #4f46e5; color: white; border: none; padding: 12px 24px;
                border-radius: 30px; font-size: 15px; font-weight: 800; cursor: pointer;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3); transition: 0.2s; font-family: Pretendard, sans-serif;
            }
            #sr-open-btn:hover { background: #6366f1; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.4); }
            
            @media(max-width: 1100px) {
              .sr-wrap.wide, .sr-wrap.wide-no-chart { max-width: 980px; }
              .sr-layout-grid.show-panels { grid-template-columns: 1fr; }
              .sr-modal-split:not(.no-chart) { grid-template-columns: 1fr; grid-template-rows: 50vh 1fr; }
              .sr-split-left { border-right: none; border-bottom: 1px solid var(--line); }
            }
        `);

        const appHtml = `
        <button id="sr-open-btn" style="display:none;">📊 실시간 댓글 랭킹</button>

        <div id="soop-rank-overlay">
          <div class="sr-wrap" id="sr-mainWrap">
            <div class="sr-top-controls">
              <div class="sr-top-row">
                <div class="sr-top-left">
                    <h1>SOOP 실시간 댓글 인기순</h1>
                    <span style="background:rgba(79,70,229,0.2); color:#818cf8; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:bold;">현재 게시글 추적 중</span>
                </div>
                <button class="sr-btn close-ui" id="sr-close-overlay">돌아가기 ✕</button>
              </div>
              <div class="sr-bottom-row">
                <button class="sr-btn" id="sr-start">실시간 시작</button>
                <button class="sr-btn secondary" id="sr-stop">중지</button>
                <input id="url" style="display:none;"> <!-- 로직 호환용 호스트 -->
                <input id="sr-userSearch" class="sr-searchbox" placeholder="닉네임 검색">
                <select id="sr-interval">
                  <option value="1000">1초 간격 갱신</option>
                  <option value="2000" selected>2초 간격 갱신</option>
                  <option value="3000">3초 간격 갱신</option>
                  <option value="5000">5초 간격 갱신</option>
                </select>
                <div class="sr-deadline-wrapper">
                  <span style="font-size:13px; color:var(--text-muted); font-weight:600;">마감 설정</span>
                  <input type="datetime-local" id="sr-deadlineTime" class="deadline-input">
                </div>
                <div id="sr-status" class="sr-status">대기 중</div>
              </div>
            </div>
            
            <div id="sr-searchResult" class="sr-search-result"></div>

            <div class="sr-layout-grid" id="sr-layoutGrid">
              <div class="sr-side-col sr-left-col" style="align-self: start;">
                <section class="sr-panel">
                  <div class="sr-head">
                    <div class="sr-title" id="sr-panelChartTitle">변화 추이</div>
                    <select id="sr-panelChartInterval" style="height:28px; font-size:12px; padding:0 8px; border-radius:6px;">
                      <option value="0">실시간</option>
                      <option value="30">30초</option>
                      <option value="60">1분</option>
                      <option value="300">5분</option>
                    </select>
                  </div>
                  <div class="sr-chart-container" style="height: 55vh; min-height: 450px;">
                    <div class="sr-chart-box">
                      <div class="sr-chart-title">누적 좋아요(♥)</div>
                      <div style="position:relative; height:calc(100% - 25px);"><canvas id="sr-panelLikeChart"></canvas></div>
                    </div>
                    <div class="sr-chart-box">
                      <div class="sr-chart-title">실시간 순위 (1위에 가까울수록 위로)</div>
                      <div style="position:relative; height:calc(100% - 25px);"><canvas id="sr-panelRankChart"></canvas></div>
                    </div>
                  </div>
                </section>
              </div>

              <div class="sr-center-col">
                <section class="sr-panel">
                  <div class="sr-head">
                    <div>
                      <div class="sr-title">인기순 (♥ 높은 순)</div>
                      <div class="sr-sub" id="sr-rankInfo">유저 클릭 → 상세정보 표시</div>
                    </div>
                    <div class="sr-head-actions">
                      <div class="sr-inline-setting" title="Off 시 유저 클릭하면 팝업(새 창)으로 뜹니다.">
                        <span>상세패널(Off:팝업)</span>
                        <label class="sr-toggle-switch"><input id="sr-togglePanels" type="checkbox"><span class="sr-slider"></span></label>
                      </div>
                      <div class="sr-inline-setting" title="차트를 켜거나 끕니다">
                        <span>그래프</span>
                        <label class="sr-toggle-switch"><input id="sr-toggleChart" type="checkbox"><span class="sr-slider"></span></label>
                      </div>
                      <label class="sr-inline-setting">Top <input id="sr-highlightN" type="number" min="0" max="99" value="3"></label>
                    </div>
                  </div>
                  <div id="sr-rank" class="sr-panel-scroll"><div class="sr-empty">실시간 시작을 눌러주세요.</div></div>
                </section>
              </div>

              <div class="sr-side-col sr-right-col">
                <section class="sr-panel" style="height:100%;">
                  <div class="sr-head">
                    <div class="sr-title" id="sr-panelCommentsTitle">유저 상세 댓글</div>
                  </div>
                  <div id="sr-panelCommentsBody" class="sr-panel-scroll" style="padding:0;">
                    <div class="sr-empty">유저를 선택해주세요.</div>
                  </div>
                </section>
              </div>
            </div>
          </div>

          <div class="sr-notice-box">💡 [프로필을 누르면 링크로 이동합니다]</div>
        </div>

        <div id="sr-combinedModal" class="sr-modal-backdrop">
          <div class="sr-modal">
            <div class="sr-modal-head">
              <div class="sr-title" id="sr-modalTitle" style="color:#fff;">유저 정보</div>
              <div style="display:flex; align-items:center; gap:12px;">
                <select id="sr-modalChartInterval" style="height:34px; font-size:13px; padding:0 10px; border-radius:8px; border:1px solid var(--line); background:#0f1218; color:#fff;">
                  <option value="0">실시간 (전체)</option>
                  <option value="30">30초 단위</option>
                  <option value="60">1분 단위</option>
                  <option value="300">5분 단위</option>
                </select>
                <button id="sr-modalClose" class="sr-btn close-ui" style="padding:0 12px;">✕</button>
              </div>
            </div>
            <div class="sr-modal-split" id="sr-modalBodySplit">
              <div class="sr-split-left">
                <div class="sr-chart-container">
                  <div class="sr-chart-box">
                    <div class="sr-chart-title">누적 좋아요(♥)</div>
                    <div style="position:relative; height:calc(100% - 25px);"><canvas id="sr-modalLikeChart"></canvas></div>
                  </div>
                  <div class="sr-chart-box">
                    <div class="sr-chart-title">실시간 순위 (1위에 가까울수록 위로)</div>
                    <div style="position:relative; height:calc(100% - 25px);"><canvas id="sr-modalRankChart"></canvas></div>
                  </div>
                </div>
              </div>
              <div id="sr-modalCommentsBody" class="sr-split-right"></div>
            </div>
          </div>
        </div>
        `;
        
        const wrapper = document.createElement('div');
        wrapper.innerHTML = appHtml;
        document.body.appendChild(wrapper);

        initializeLogic();
    }

    function initializeLogic() {
        const $ = id => document.getElementById(id);
        
        $('sr-open-btn').addEventListener('click', () => {
            $('soop-rank-overlay').style.display = 'block';
            document.body.style.overflow = 'hidden'; 
        });
        $('sr-close-overlay').addEventListener('click', () => {
            $('soop-rank-overlay').style.display = 'none';
            document.body.style.overflow = '';
        });

        let timer = null;
        let all = [];
        let seen = new Set();
        let commentBaselines = new Map(); 
        let initialRanks = new Map();     
        let userHistory = new Map(); 
        let info = null;

        let pinnedUsers = new Set();
        try {
            const savedPins = JSON.parse(GM_getValue("soopPinnedUsers", "[]"));
            if(Array.isArray(savedPins)) pinnedUsers = new Set(savedPins);
        } catch(e){}

        let highlightN = Number(GM_getValue("soopHighlightN", 3));
        let showPanels = GM_getValue("soopShowPanels", true);
        let showChart = GM_getValue("soopShowChart", true); 

        let likeChartInstance = null;
        let rankChartInstance = null;
        let currentChartUser = null;

        $("sr-highlightN").value = highlightN;
        $("sr-togglePanels").checked = showPanels;
        $("sr-toggleChart").checked = showChart;

        document.addEventListener('click', function(e) {
            if(e.target && e.target.classList.contains('sr-pin-btn')) {
                e.stopPropagation();
                const user = e.target.getAttribute('data-user');
                if (pinnedUsers.has(user)) pinnedUsers.delete(user);
                else pinnedUsers.add(user);
                GM_setValue("soopPinnedUsers", JSON.stringify([...pinnedUsers]));
                renderSearch();
                render(); 
            }
        });

        function updateLayout() {
            const wrap = $("sr-mainWrap");
            const grid = $("sr-layoutGrid");
            if (showPanels) {
                grid.className = "sr-layout-grid show-panels" + (showChart ? "" : " no-chart");
                wrap.className = "sr-wrap wide" + (showChart ? "" : "-no-chart");
                $("sr-combinedModal").style.display = "none";
                if (showChart && currentChartUser) setTimeout(() => renderChart('panel'), 150); 
            } else {
                grid.className = "sr-layout-grid";
                wrap.className = "sr-wrap";
            }
        }
        updateLayout();

        function esc(s){ return String(s ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m])); }

        function parseUrl(urlStr = window.location.href){
            let m = urlStr.match(/\/station\/([^/]+)\/post\/(\d+)/);
            if (m) return { station: m[1], post: m[2] };
            m = urlStr.match(/ch\.sooplive\.(?:co\.kr|com)\/([^/]+)\/post\/(\d+)/);
            if (m) return { station: m[1], post: m[2] };
            m = urlStr.match(/\/([^/]+)\/post\/(\d+)/);
            if (m && !m[1].includes("station")) return { station: m[1], post: m[2] };
            throw new Error("현재 페이지가 SOOP 게시글 화면이 아닙니다.");
        }

        function fixUrl(u) {
            if (!u) return "";
            const str = String(u).trim();
            return str.startsWith("//") ? "https:" + str : str;
        }

        function avatarUrl(c) {
            const raw = String(c?.profile || "").trim();
            if (raw) return fixUrl(raw);
            const id = String(c?.userId || "").trim();
            if (!id) return "";
            return `https://stimg.sooplive.com/LOGO/${id.slice(0, 2)}/${encodeURIComponent(id)}/m/${encodeURIComponent(id)}.webp`;
        }

        function getFallbackSrc(userId) {
            const id = String(userId || "").trim();
            if (!id) return "";
            const enc = encodeURIComponent(id);
            return `https://profile.img.sooplive.com/LOGO/${enc.slice(0, 2)}/${enc}/m/${enc}.jpg`;
        }

        function toItem(x) {
            let id = x.comment_no;
            if (x.c_comment_no && x.c_comment_no != 0) id = x.c_comment_no;
            else if (x.p_comment_no && x.p_comment_no != 0) id = x.p_comment_no;
            if (!id) return null;
            
            const rawHtml = String(x.commentHtml ?? x.comment ?? x.content ?? "");
            let images = [], links = [], videos = [];

            if (rawHtml.includes("<")) {
                const doc = new DOMParser().parseFromString(rawHtml, "text/html");
                doc.querySelectorAll("img").forEach(img => {
                    const src = img.getAttribute("data-src") || img.getAttribute("src") || img.getAttribute("data-original");
                    if (src && !src.includes("emoticon") && !src.includes("badge")) images.push(fixUrl(src));
                });
                doc.querySelectorAll("a[href]").forEach(a => links.push({href: a.href, text: (a.textContent||"").trim()}));
            }

            const attachArr = [].concat(x.attach_file||[], x.attach_files||[]);
            attachArr.forEach(f => { if(f?.url) images.push(fixUrl(f.url)); else if(f?.file_url) images.push(fixUrl(f.file_url)); });

            const collect = (v) => {
                if (!v) return;
                if (Array.isArray(v)) { v.forEach(collect); return; }
                if (typeof v === "object") {
                    for (const [k, val] of Object.entries(v)) {
                        if (typeof val === 'string' && (val.startsWith("http") || val.startsWith("//"))) {
                            if (/\.(png|jpe?g|gif|webp|bmp)/i.test(val) || /image|file|attach/i.test(k)) {
                                if (!val.includes("profile") && !val.includes("/LOGO/") && !val.includes("emoticon") && !val.includes("badge")) {
                                    images.push(fixUrl(val));
                                }
                            }
                        }
                    }
                    Object.values(v).forEach(collect);
                }
            };
            collect(x);

            const rawString = JSON.stringify(x);
            const urlMatches = rawString.match(/(?:https?:)?\/\/[a-zA-Z0-9.-]+\.sooplive\.[a-z.]{2,}\/[^"'\s\\>}<]+/gi) || [];
            urlMatches.forEach(u => {
                const str = fixUrl(u.replace(/\\/g, ''));
                if (str.includes("stimg.") || str.includes("stfile.") || str.includes("afreecatv.")) {
                    if (!str.includes("profile") && !str.includes("/LOGO/") && !str.includes("emoticon") && !str.includes("badge") && !str.includes(".js")) {
                        images.push(str);
                    }
                }
            });

            let text = rawHtml.includes("<") ? new DOMParser().parseFromString(rawHtml, "text/html").body.innerText.trim() : String(x.text ?? x.commentText ?? rawHtml).trim();

            return {
                id: String(id), user: String(x.user_nick ?? x.user_id ?? "알 수 없음"), userId: String(x.user_id ?? ""),
                profile: fixUrl(String(x.profile_image ?? x.profile_img ?? x.profileImage ?? "")),
                content: text, images: [...new Set(images)].map(src => ({ src, alt: "첨부 이미지" })), links, videos,
                time: String(x.reg_date ?? x.create_date ?? ""), like: Number(x.like_cnt ?? x.up_cnt ?? 0) || 0
            };
        }

        function fetchJson(url) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: "GET", url: url, responseType: "json",
                    onload: function(res) {
                        if(res.status === 200) resolve(res.response);
                        else reject(new Error("HTTP " + res.status));
                    },
                    onerror: function() { reject(new Error("네트워크 오류")); }
                });
            });
        }

        async function poll(){
            if(!info) return;
            try{
                let page = 1, added = 0;
                while(page <= 20){
                    const url = `https://chapi.sooplive.co.kr/api/${encodeURIComponent(info.station)}/title/${encodeURIComponent(info.post)}/comment?page=${page}`;
                    const json = await fetchJson(url);
                    const list = Array.isArray(json?.data) ? json.data : [];
                    if(!list.length) break;

                    for(const raw of list){
                        const c = toItem(raw);
                        if(!c) continue;
                        const oldIndex = all.findIndex(v => v.id === c.id);
                        if(oldIndex >= 0) all[oldIndex] = {...all[oldIndex], ...c}; 
                        else { seen.add(c.id); commentBaselines.set(c.id, c.like); all.push(c); added++; }
                    }
                    if(page >= Number(json?.meta?.last_page ?? page)) break;
                    page++;
                }

                all.sort((a,b)=> (Date.parse(a.time)||0) - (Date.parse(b.time)||0) || Number(a.id)-Number(b.id));
                
                const nowMs = Date.now();
                userGroups().forEach(([user, u], index) => {
                    if(!userHistory.has(user)) userHistory.set(user, []);
                    userHistory.get(user).push({ timeMs: nowMs, likes: u.like, rank: index + 1 });
                });

                if (currentChartUser && (showPanels || $("sr-combinedModal").style.display === "flex")) {
                    showUserComments(currentChartUser, false);
                }

                $("sr-status").textContent=`연결됨 · ${new Date().toLocaleTimeString()} · ${added ? added+"개 신규 댓글" : "변경 없음"}`;
                render();
            }catch(e){
                $("sr-status").textContent="연결 실패 (새로고침 요망)";
            }
        }

        function userGroups(){
            const m = new Map();
            for(const c of all){
                if(!m.has(c.user)) m.set(c.user,{like:0, diff:0, comments:[], avatar:"", userId: c.userId});
                const u=m.get(c.user);
                u.like += c.like || 0;
                u.diff += ((c.like || 0) - (commentBaselines.get(c.id) || 0));
                u.comments.push(c);
                if(!u.avatar) u.avatar = avatarUrl(c);
            }
            return [...m.entries()].sort((a,b)=> b[1].like!==a[1].like ? b[1].like-a[1].like : a[0].localeCompare(b[0],"ko"));
        }

        function getLikeDiffHtml(diff) { return diff > 0 ? `<span class="sr-up">▲${diff}</span>` : diff < 0 ? `<span class="sr-down">▼${Math.abs(diff)}</span>` : `<span class="sr-same">-</span>`; }
        function getRankDiffHtml(diff) { return diff > 0 ? `<div class="sr-rank-diff sr-up">▲${diff}</div>` : diff < 0 ? `<div class="sr-rank-diff sr-down">▼${Math.abs(diff)}</div>` : `<div class="sr-rank-diff sr-same">-</div>`; }
        function getRankDiffInlineHtml(diff) { return diff > 0 ? `<span class="sr-up" style="margin-left:4px;">▲${diff}</span>` : diff < 0 ? `<span class="sr-down" style="margin-left:4px;">▼${Math.abs(diff)}</span>` : `<span class="sr-same" style="margin-left:4px;">-</span>`; }

        function renderChart(mode) {
            if(!showChart || !currentChartUser) return;
            const history = userHistory.get(currentChartUser) || [];
            const likeCanvasId = (mode === 'panel') ? 'sr-panelLikeChart' : 'sr-modalLikeChart';
            const rankCanvasId = (mode === 'panel') ? 'sr-panelRankChart' : 'sr-modalRankChart';
            const intervalSelect = (mode === 'panel') ? $("sr-panelChartInterval") : $("sr-modalChartInterval");
            
            const ctxLike = $(likeCanvasId)?.getContext('2d');
            const ctxRank = $(rankCanvasId)?.getContext('2d');
            if (!ctxLike || !ctxRank) return;

            if(likeChartInstance) likeChartInstance.destroy();
            if(rankChartInstance) rankChartInstance.destroy();
            if(history.length === 0) return;

            const intervalSec = parseInt(intervalSelect.value, 10);
            let plotData = [];
            if (intervalSec === 0) {
                plotData = history.map(h => ({ time: new Date(h.timeMs).toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' }), likes: h.likes, rank: h.rank }));
            } else {
                const intervalMs = intervalSec * 1000;
                const grouped = new Map();
                history.forEach(h => grouped.set(Math.floor(h.timeMs / intervalMs) * intervalMs, { likes: h.likes, rank: h.rank }));
                plotData = Array.from(grouped.keys()).sort((a,b)=>a-b).map(k => ({ time: new Date(k).toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' }), likes: grouped.get(k).likes, rank: grouped.get(k).rank }));
            }

            Chart.defaults.font.family = "'Pretendard Variable', Pretendard, sans-serif";
            let likeGradient = ctxLike.createLinearGradient(0, 0, 0, 300); likeGradient.addColorStop(0, 'rgba(79, 70, 229, 0.5)'); likeGradient.addColorStop(1, 'rgba(79, 70, 229, 0)');
            
            likeChartInstance = new Chart(ctxLike, {
                type: 'line',
                data: { labels: plotData.map(d => d.time), datasets: [{ label: '누적 좋아요', data: plotData.map(d => d.likes), borderColor: '#818cf8', backgroundColor: likeGradient, borderWidth: 3, pointBackgroundColor: '#fff', pointBorderColor: '#4f46e5', pointRadius: 4, fill: true, tension: 0.1 }] },
                options: { responsive: true, maintainAspectRatio: false, scales: { x: { ticks:{color:'#94a3b8'}, grid:{color:'#2a313e'} }, y: { ticks:{color:'#94a3b8', stepSize:10}, grid:{color:'#2a313e'} } }, plugins: { legend: {display: false}, tooltip: {backgroundColor:'#1e293b'} } }
            });

            let rankGradient = ctxRank.createLinearGradient(0, 0, 0, 300); rankGradient.addColorStop(0, 'rgba(251, 191, 36, 0.4)'); rankGradient.addColorStop(1, 'rgba(251, 191, 36, 0)');
            rankChartInstance = new Chart(ctxRank, {
                type: 'line',
                data: { labels: plotData.map(d => d.time), datasets: [{ label: '실시간 순위', data: plotData.map(d => d.rank), borderColor: '#fbbf24', backgroundColor: rankGradient, borderWidth: 3, pointBackgroundColor: '#fff', pointBorderColor: '#d97706', pointRadius: 4, fill: true, tension: 0.1 }] },
                options: { responsive: true, maintainAspectRatio: false, scales: { x: { ticks:{color:'#94a3b8'}, grid:{color:'#2a313e'} }, y: { reverse: true, ticks:{color:'#94a3b8', stepSize:1}, grid:{color:'#2a313e'} } }, plugins: { legend: {display: false}, tooltip: {backgroundColor:'#1e293b'} } }
            });
        }

        $("sr-panelChartInterval").addEventListener("change", () => renderChart('panel'));
        $("sr-modalChartInterval").addEventListener("change", () => renderChart('modal'));

        function renderSearch(){
            const box=$("sr-searchResult"), q=$("sr-userSearch").value.trim().toLowerCase();
            const allGroups = userGroups();
            let itemsToShow = allGroups.map((g, index) => ({ user: g[0], u: g[1], rank: index+1, rankDiff: (initialRanks.get(g[0])||index+1)-(index+1), isPinned: pinnedUsers.has(g[0]) }));
            
            itemsToShow = q ? itemsToShow.filter(item => item.user.toLowerCase().includes(q)) : itemsToShow.filter(item => item.isPinned);

            if(!itemsToShow.length){
                box.style.display = q ? "block" : "none";
                box.innerHTML = q ? `<div class="sr-empty">검색 결과가 없습니다.</div>` : "";
                return;
            }
            
            const baseUrl = window.location.href.split('?')[0].split('#')[0];
            box.innerHTML=itemsToShow.slice(0,20).map(item=>{
                const {user, u, rank, rankDiff, isPinned} = item;
                const bestComment = u.comments.reduce((max, curr) => (curr.like > max.like ? curr : max), u.comments[0]);
                return `<div class="sr-search-card" data-user="${esc(user)}">
                  <img class="sr-avatar" src="${esc(u.avatar||getFallbackSrc(u.userId))}" title="이동" onclick="window.open('${baseUrl}#comment_noti${bestComment?.id||''}', '_blank'); event.stopPropagation();">
                  <div>
                    <div class="sr-user"><button class="sr-pin-btn ${isPinned?'active':''}" data-user="${esc(user)}">${isPinned?'★':'☆'}</button> ${esc(user)} <span class="sr-rank-badge">현재 ${rank}위 ${getRankDiffInlineHtml(rankDiff)}</span></div>
                    <div class="sr-meta">댓글 ${u.comments.length}개 · 누적 ♥ ${u.like.toLocaleString()}</div>
                  </div>
                  <div class="sr-num clickable-like" data-user="${esc(user)}">${u.like.toLocaleString()} ♥ ${getLikeDiffHtml(u.diff)}<small style="display:block;font-size:11px;color:#64748b;margin-top:4px;">${isPinned&&!q?'고정됨':'검색결과'}</small></div>
                </div>`;
            }).join("");
            box.style.display="block";
            box.querySelectorAll(".sr-search-card").forEach(card=>card.onclick=()=>showUserComments(card.dataset.user));
            box.querySelectorAll(".clickable-like").forEach(el=>{ el.onclick = (e) => { e.stopPropagation(); showUserComments(el.dataset.user); }; });
        }

        function render(){
            const groups=userGroups();
            groups.forEach(([user], index) => { if (!initialRanks.has(user)) initialRanks.set(user, index + 1); });
            $("sr-rankInfo").textContent=`댓글 ${all.length} · 작성자 ${groups.length} · 상위 ${highlightN}명 하이라이트`;

            if(!groups.length){ $("sr-rank").innerHTML=`<div class="sr-empty">실시간 시작을 눌러주세요.</div>`; renderSearch(); return; }

            const baseUrl = window.location.href.split('?')[0].split('#')[0];
            $("sr-rank").innerHTML=groups.map(([user,u],i)=>{
                const rank = i+1, isPinned = pinnedUsers.has(user);
                const bestComment = u.comments.reduce((max, curr) => (curr.like > max.like ? curr : max), u.comments[0]);
                let cls="sr-rankrow" + (highlightN>0 && i<highlightN ? " topn" + (i<3?" top"+(i+1):"") : "");
                
                return `<div class="${cls}">
                  <div class="sr-rank-col"><div class="sr-no">${rank}</div>${getRankDiffHtml((initialRanks.get(user)||rank)-rank)}</div>
                  <img class="sr-avatar" src="${esc(u.avatar||getFallbackSrc(u.userId))}" title="이동" onclick="window.open('${baseUrl}#comment_noti${bestComment?.id||''}', '_blank'); event.stopPropagation();">
                  <div class="sr-nick" data-user="${esc(user)}"><button class="sr-pin-btn ${isPinned?'active':''}" data-user="${esc(user)}">${isPinned?'★':'☆'}</button>${esc(user)}</div>
                  <div class="sr-num clickable-like" data-user="${esc(user)}">${u.like.toLocaleString()} ♥ ${getLikeDiffHtml(u.diff)}</div>
                </div>`;
            }).join("");

            $("sr-rank").querySelectorAll(".sr-nick").forEach(el=>el.onclick=()=>showUserComments(el.dataset.user));
            $("sr-rank").querySelectorAll(".clickable-like").forEach(el=>{ el.onclick = (e) => { e.stopPropagation(); showUserComments(el.dataset.user); }; });

            if(showPanels && currentChartUser) showUserComments(currentChartUser, false);
            renderSearch();
        }

        function showUserComments(user, triggerOpen = true){
            currentChartUser = user;
            const mine = all.filter(c=>c.user===user).sort((a,b)=>(Date.parse(a.time)||0)-(Date.parse(b.time)||0) || Number(a.id)-Number(b.id));
            const baseUrl = window.location.href.split('?')[0].split('#')[0];

            const html = mine.map(c=>{
                const imgs = (c.images||[]).map(im=>`<img class="sr-uc-img" src="${esc(im.src)}" onclick="window.open(this.src,'_blank')">`).join("");
                const url = `${baseUrl}#comment_noti${c.id}`;
                return `<div class="sr-user-comment">
                  <div class="sr-uc-head">
                    <img class="sr-uc-avatar" src="${esc(avatarUrl(c)||getFallbackSrc(c.userId))}" onclick="window.open('${url}', '_blank');" style="cursor:pointer;">
                    <div class="sr-uc-top"><span><a href="${url}" target="_blank">${esc(c.time)}</a></span><span class="sr-uc-like">${c.like.toLocaleString()} ♥ ${getLikeDiffHtml((c.like||0)-(commentBaselines.get(c.id)||0))}</span></div>
                  </div>
                  <div class="sr-uc-text">${esc(c.content)}</div>${imgs}
                </div>`;
            }).join("") || `<div class="sr-empty">댓글 내용이 없습니다.</div>`;

            if (showPanels) {
                $("sr-combinedModal").style.display = "none";
                $("sr-panelCommentsBody").innerHTML = html;
                $("sr-panelCommentsTitle").textContent = `${user}님 댓글 (${mine.length}개)`;
                if (showChart) { if(triggerOpen) setTimeout(() => renderChart('panel'), 50); else renderChart('panel'); }
            } else {
                $("sr-modalCommentsBody").innerHTML = html;
                $("sr-modalTitle").textContent = `${user}님 상세 정보 (${mine.length}개)`;
                $("sr-modalBodySplit").className = "sr-modal-split" + (showChart ? "" : " no-chart");
                $("sr-modalChartInterval").style.display = showChart ? "inline-block" : "none";
                if(triggerOpen) { $("sr-combinedModal").style.display = "flex"; if (showChart) setTimeout(() => renderChart('modal'), 50); }
                else if (showChart && $("sr-combinedModal").style.display === "flex") renderChart('modal');
            }
        }

        async function start(){
            stop();
            try{
                const dl = $("sr-deadlineTime").value;
                if (dl && Date.now() >= new Date(dl).getTime()) { alert("마감시간이 이미 지났습니다."); return; }
                info = parseUrl();
                all = []; seen.clear(); commentBaselines.clear(); initialRanks.clear(); userHistory.clear(); currentChartUser = null;
                $("sr-panelCommentsBody").innerHTML = `<div class="sr-empty">유저를 선택해주세요.</div>`;
                if(likeChartInstance) { likeChartInstance.destroy(); likeChartInstance = null; }
                if(rankChartInstance) { rankChartInstance.destroy(); rankChartInstance = null; }
                render(); await poll();
                if(timer===null) {
                    timer=setInterval(async () => {
                        const currentDl = $("sr-deadlineTime").value;
                        if (currentDl && Date.now() >= new Date(currentDl).getTime()) { stop(); $("sr-status").textContent = "마감시간 도달 - 중지됨"; return; }
                        await poll();
                    }, Number($("sr-interval").value));
                }
            }catch(e){ alert(e.message); }
        }

        function stop(){ if(timer!==null){ clearInterval(timer); timer=null; } }

        $("sr-start").onclick = start;
        $("sr-stop").onclick = () => { stop(); $("sr-status").textContent="중지됨"; };
        $("sr-userSearch").addEventListener("input", renderSearch);
        
        $("sr-togglePanels").onchange = (e) => { showPanels = e.target.checked; GM_setValue("soopShowPanels", showPanels); updateLayout(); if (currentChartUser) showUserComments(currentChartUser, true); };
        $("sr-toggleChart").onchange = (e) => { showChart = e.target.checked; GM_setValue("soopShowChart", showChart); updateLayout(); if (currentChartUser) showUserComments(currentChartUser, true); };
        $("sr-highlightN").oninput = e => { highlightN = Math.max(0,parseInt(e.target.value||"0")||0); GM_setValue("soopHighlightN", highlightN); render(); };
        $("sr-modalClose").onclick = () => $("sr-combinedModal").style.display="none";
        
        document.addEventListener("keydown", e => { if(e.key==="Escape") $("sr-combinedModal").style.display="none"; });
    }
})();