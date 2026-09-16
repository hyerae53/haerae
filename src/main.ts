import './styles.css';
import { api, auth } from '@appdeploy/client';

const frame = document.getElementById('portfolioFrame') as HTMLIFrameElement;
const toolbar = document.getElementById('editorToolbar') as HTMLDivElement;
const statusEl = document.getElementById('editorStatus') as HTMLSpanElement;
const signInBtn = document.getElementById('signInBtn') as HTMLButtonElement;
const toggleEditBtn = document.getElementById('toggleEditBtn') as HTMLButtonElement;
const publishBtn = document.getElementById('publishBtn') as HTMLButtonElement;
const discardBtn = document.getElementById('discardBtn') as HTMLButtonElement;
const toast = document.getElementById('toast') as HTMLDivElement;
const EDIT_MODE = new URLSearchParams(window.location.search).get('edit') === '1';
const DRAFT_KEY = 'hyerae-portfolio-draft-v3';
const BASE_URL = 'https://raw.githubusercontent.com/hyerae53/hyerae-s-portfolio/40a5b4eda83d6372ca1af1ae01ae25c6ad5701df/latest/';
const BASE_PARTS = 8;
const REFERENCE_MARKER = 'uploaded-pdf-2026-09-16-18-36-25';
let editing = false;
let autosaveTimer: number | null = null;

interface PortfolioResponse { html?: string | null; updatedAt?: string | null }
interface DraftPayload { html: string; savedAt: string }

function showToast(message: string) {
  toast.textContent = message;
  toast.hidden = false;
  window.setTimeout(() => { toast.hidden = true; }, 2600);
}
function setStatus(message: string) { statusEl.textContent = message; }
function setText(root: ParentNode, selector: string, text: string) {
  const el = root.querySelector(selector);
  if (el) el.textContent = text;
}
function setList(root: ParentNode, selector: string, items: string[]) {
  const ul = root.querySelector(selector);
  if (!ul) return;
  ul.replaceChildren(...items.map(text => {
    const li = document.createElement('li');
    li.textContent = text;
    return li;
  }));
}
function setLogic(article: Element, entries: Array<[string, string]>) {
  article.querySelectorAll('.logic-item').forEach((item, index) => {
    const entry = entries[index];
    if (!entry) return;
    const b = item.querySelector('b');
    const p = item.querySelector('p');
    if (b) b.textContent = entry[0];
    if (p) p.textContent = entry[1];
  });
}
function setMeta(article: Element, period: string, keywords: string) {
  const ps = article.querySelectorAll('.meta-detail p');
  if (ps[0]) ps[0].innerHTML = '<b>기간</b> ' + period;
  if (ps[1]) ps[1].innerHTML = '<b>주요 키워드</b> ' + keywords;
}
function setExperience(article: Element, intro: string | null, sections: Array<[string, string[]]>) {
  const introEl = article.querySelector('.exp-intro');
  if (introEl && intro !== null) introEl.textContent = intro;
  const prose = article.querySelector('.exp-prose');
  if (!prose) return;
  prose.replaceChildren(...sections.map(([label, bullets]) => {
    const p = document.createElement('p');
    const b = document.createElement('b');
    b.textContent = label;
    p.appendChild(b);
    bullets.forEach(text => {
      p.appendChild(document.createElement('br'));
      p.appendChild(document.createTextNode('- ' + text));
    });
    return p;
  }));
}

function normalizePortfolioHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const marker = doc.querySelector('meta[name="portfolio-reference"]')?.getAttribute('content');
  doc.title = "Hyerae's Portfolio";
  if (marker === REFERENCE_MARKER) return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
  doc.querySelectorAll('h3').forEach(h => {
    if (h.textContent?.includes('｜')) h.textContent = h.textContent.replaceAll('｜', ' | ').replace(/\s+/g, ' ').trim();
  });
  setText(doc, '.hero .thesis', '보험부채와 시장흐름을 이해하고, 데이터로 운용 판단의 근거를 만듭니다.');
  const profile = doc.querySelectorAll('#profile .profile-block');
  if (profile[0]) profile[0].innerHTML = '<h3>Education</h3><p><b>연세대학교, 응용통계학과</b><br>2022.03 – 2027.02 (졸업예정), GPA 4.04 / 4.3</p><p style="margin-top:7px"><b>University of Florida</b><br>교환학생, 2025.01 – 2025.05</p>';
  if (profile[1]) profile[1].innerHTML = '<h3>Certificate</h3><ul><li>SQLD</li><li>ADsP</li><li>금융투자분석사</li><li>투자자산운용사</li><li>파생상품투자권유자문인력</li><li>OPIc 영어 IH</li></ul>';
  if (profile[2]) profile[2].innerHTML = '<h3>Contact</h3><p><b>Email</b> johaerae@gmail.com<br><b>Mobile</b> +82 10-9138-0184<br><b>LinkedIn</b> linkedin.com/in/혜래-조-692610267</p>';
  const db = doc.querySelector('#db-selected');
  if (db) {
    setText(db, '.core-sub', '2007 Q1~2024 Q3 생명보험 7개 상품군 데이터로 거시경제 및 소비자심리변수가 보험 가입 및 해지에 미치는 영향을 분석했습니다.');
    setLogic(db, [
      ['문제', '해지율만으로는 신규계약까지 포함한 보험시장의 순유입·순유출 구조를 설명하기 어려웠음'],
      ['과정', '7개 상품군의 신규계약·해지 시계열과 거시경제·소비자심리 지표를 결합하고, 경기국면별 관계를 비교'],
      ['결과', '신규계약과 해지를 함께 보는 ‘계약-해지 스프레드’를 중심지표로 제안했고, DB 보험금융 공모전 가작을 수상'],
    ]);
    setList(db, '.detail-card:not(.learned) ul', [
      '생명보험 7개 상품군의 신규계약·해지 데이터를 거시경제·소비자심리 지표와 직접 결합해 2007년 1분기부터 2024년 3분기까지의 분석용 시계열을 구축',
      '기존 해지율만으로는 계약 이탈만 보인다는 한계를 발견하고, 신규계약과 해지를 함께 보는 ‘계약-해지 스프레드’를 중심지표로 새로 정의',
      '과거 연구논문을 참고해 GMM, Johansen 공적분 검정, VECM, 충격반응분석을 학습하고 필요한 코드를 직접 구현해 상품군·경기국면별 차이를 검증',
    ]);
    setList(db, '.detail-card.learned ul', ['같은 거시 변수도 상품 특성과 경기 국면에 따라 영향 방향과 크기가 달라질 수 있어 평균적인 관계보다 세분화된 시나리오가 중요하다는 점을 확인']);
  }
  const bot = doc.querySelector('#bot-selected');
  if (bot) {
    setText(bot, '.core-sub', 'Rates, FX, Stock 시장의 종가·수급·변동 원인을 매일 모니터링하는 Bot을 구축했습니다.');
    setLogic(bot, [
      ['문제', '채권, 금리파생, 환율, 주식의 마감 수치와 뉴스가 여러 출처에 흩어져 있어 탐색이 비효율적'],
      ['과정', '국고채·국채선물·IRS·본드스와프·원/달러·증시에 관련된 기사를 크롤링 및 정리하는 로직 구축'],
      ['결과', '매 영업일 시장 마감 데이터와 수급, 변동 원인을 Telegram으로 전달하는 개인용 브리핑 시스템 구축'],
    ]);
  }
  const alm = doc.querySelector('#alm');
  if (alm) {
    setText(alm, '.core-sub', '보험부채 현금흐름을 직접 만들고 5개 만기구간의 금리민감도를 측정해, 3y×27y 채권선도로 장기 듀레이션 갭을 축소하는 시뮬레이션을 수행했습니다.');
    setLogic(alm, [
      ['문제', '자산보다 부채의 장기 금리민감도가 커 10년 초과 구간의 듀레이션 갭이 -1.589까지 확대'],
      ['과정', '채권 자산 포트폴리오와 보험 종목별 월별 부채 현금흐름을 구성하고, 5개 만기구간 듀레이션과 필요한 채권선도 편입비중을 계산'],
      ['결과', '3y×27y 채권선도를 약 5.14% 편입하는 시뮬레이션으로 10년 초과 구간 갭을 -1.589 → -0.885로 축소'],
    ]);
  }
  const exps = doc.querySelectorAll('#experience .exp');
  if (exps[0]) {
    setText(exps[0], 'h3', 'Société Générale Seoul Branch | RISQ Trainee');
    setExperience(exps[0], null, [
      ['[Daily | 리스크 모니터링]', ['시장·신용·유동성 위험 및 트레이딩 포지션 P&L을 매일 점검', '데이터 취합·정리 업무를 Excel VBA로 자동화해 반복적인 보고의 처리 속도를 약 30% 개선']],
      ['[Monthly | 규제자본 산출]', ['GIRR, FX, Curvature 등 위험요소별 시장리스크 소요자기자본 산출을 지원', '금리·환율 및 가격 변화에 따른 위험액 산출 구조를 Excel로 직접 재현하고 결과를 검증']],
      ['[Quarterly | 전사 리스크관리위원회 준비]', ['내부 신용평가 리포트를 검토해 고객사의 사업·재무 현황, 주요 위험요인과 신용등급 변동 사유를 정리', '시장리스크 관련 주요 이슈를 조사하고 전사 리스크관리위원회(ERMC) 보고용 PPT 자료를 작성']],
      ['[투자 적정성 검토]', ['기업 인수금융 딜에서 모회사의 지원 가능성, 레버리지, 영업현금흐름뿐 아니라 RAROC의 내부 기준 충족 여부, RWA 부담, 셀다운을 통한 익스포저 분산 여력까지 함께 검토']],
    ]);
  }
  if (exps[1]) {
    setText(exps[1], 'h3', 'PwC Consulting | Research Assistant');
    setExperience(exps[1], '국내 대형 건설사의 현장 안전관리 고도화 프로젝트에 참여', [
      ['[데이터 정제·매핑]', ['산업안전 데이터 약 2,000건을 Excel로 가공하며 결측치와 입력 오류를 전처리', '여러 출처의 사고 데이터를 하나의 기준으로 통합하기 위해 사고유형, 발생원인, 현장정보 등을 매핑해 정리']],
      ['[패턴 분석]', ['정제한 데이터를 바탕으로 사고 발생과 공정·시간대별 패턴을 분석', '분석 결과를 Excel과 Python으로 시각화']],
      ['[추가 분석]', ['위험성평가 데이터 약 300건을 기존 사고 데이터에 매핑해 공정률, 계약금액, 근로기간 등과 사고 발생의 관계를 추가로 검토', '분석 과정에서 현장별 작업량이라는 분모가 없으면 사고건수만으로 실제 위험도를 비교하기 어렵다는 한계를 발견']],
      ['[산업 리서치]', ['국내외 건설사의 안전관리 제도와 신기술 도입 사례를 조사하고 벤치마킹 자료를 작성']],
    ]);
  }
  doc.querySelectorAll('#other .detail-card.learned').forEach(el => el.remove());
  const letf = doc.querySelector('#letf');
  if (letf) {
    setText(letf, 'h3', 'Y-FoRM | ETF Flow 및 LETF 리밸런싱 수요를 활용한 트레이딩 전략 구현');
    setMeta(letf, '2026.05 – 2026.06', 'Python, ETF Flow, 리밸런싱, 트레이딩');
    setList(letf, '.detail-card ul', [
      '국내 상장 ETF 1,309개를 분석 목적에 맞는 297개로 정제하고, ETF Flow 지표를 이용한 거래전략 구현',
      '미국 단일종목 Leveraged ETF와 삼성전자·SK하이닉스 LETF의 AUM·1분봉 데이터를 이용해 장 후반 기계적 리밸런싱 수요를 이용한 거래전략 구현',
      '실제 거래비용까지 반영해 통계적으로 관찰되는 가격왜곡과 실제 거래 가능한 기회를 구분',
    ]);
  }
  const ktb = doc.querySelector('#ktb');
  if (ktb) {
    setMeta(ktb, '2025.10 – 2025.12', 'Python, 국채선물, 베이시스, 트레이딩');
    setList(ktb, '.detail-card ul', [
      '3년·10년 국채선물의 바스켓 채권과 Cost of Carry를 반영해 선물이론가를 직접 산출하고, 바스켓별 내재조달금리로 CTD를 동적으로 선정',
      '이론가와 시장가의 괴리를 이용한 베이시스 트레이딩 전략을 만든 뒤 거래량, 미결제약정, 외국인 수급을 단계적으로 반영해 가격신호가 실제로 거래 가능한가를 점검',
      '2022년 레고랜드 사태를 별도 분석해 평시의 평균회귀 가정이 유동성 충격 구간에서도 유지되는지 확인',
    ]);
  }
  const gm = doc.querySelector('#gm');
  if (gm) setList(gm, '.detail-card ul', ['주문흐름 불균형과 VPIN을 계산하고, Granger 인과검정으로 정보거래자와 가격흐름의 인과성 검정', '추가지표를 도입 후 Ridge Regression으로 선별', '시장미시구조 지표를 “예측값”이 아니라 가격발견 과정의 보조정보로 보는 관점을 얻음']);
  const loan = doc.querySelector('#loan');
  if (loan) setList(loan, '.detail-card ul', ['148,670건·34개 변수의 대출 데이터를 정리해 125,547건의 분석 데이터를 만들고, 결측·이상치·신용점수 기준 차이와 클래스 불균형을 직접 처리', 'Decision Tree와 Gradient Boosting을 비교하고, 교차검증을 통해 최종 모형을 선택한 뒤 변수 중요도를 이용해 부도위험 요인을 해석', 'Gradient Boosting으로 RMSE를 0.57에서 0.33으로 낮추고 R²를 0.176에서 0.452로 개선']);
  const acts = doc.querySelectorAll('#activities .act');
  if (acts[0]) setList(acts[0], 'ul', ['매주 FICC 시사스터디 리포트 작성', 'John C. Hull 「Options, Futures, and Other Derivatives (11th edition)」 기반 파생상품 이론 학습', 'VaR & ES 정규세션 진행', '트레이딩 및 리스크관리 관련 프로젝트 4회 진행', 'DB보험금융공모전 가작 수상']);
  if (acts[1]) setList(acts[1], 'ul', ['AP&PO 세션: Fama-French 3-Factor, Black-Litterman, CPPI 등 자산가격결정과 포트폴리오 구성 방법 학습', 'FE 세션: 차익거래, Forward, Swap, 금리, 고정수익, 기간구조와 Monte Carlo Simulation 학습', 'Udacity AI for Trading, Quantitative Equity Portfolio Management 교재 및 실습을 통해 정량 운용 방법론 학습', '리크루팅을 총괄하고 Google Spreadsheet로 지원자, 일정, 평가 결과를 통합 관리']);
  const meta = doc.createElement('meta');
  meta.setAttribute('name', 'portfolio-reference');
  meta.setAttribute('content', REFERENCE_MARKER);
  doc.head.appendChild(meta);
  return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
}

async function loadBaseHtml() {
  const parts = await Promise.all(Array.from({ length: BASE_PARTS }, (_, i) => fetch(BASE_URL + i + '.txt', { cache: 'no-store' }).then(r => {
    if (!r.ok) throw new Error('part ' + i);
    return r.text();
  })));
  return parts.join('');
}
async function loadPublishedHtml() {
  try {
    const response = await api.get('/api/portfolio');
    const data = response.data as PortfolioResponse;
    if (data.html) return data.html;
  } catch (error) {
    console.warn('Published portfolio lookup failed; using base.', error);
  }
  return loadBaseHtml();
}
function getDraft(): DraftPayload | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftPayload;
    return parsed.html ? parsed : null;
  } catch { return null; }
}
function frameDocument() {
  const doc = frame.contentDocument;
  if (!doc) throw new Error('Portfolio preview unavailable.');
  return doc;
}
function serializeHtml() {
  const clone = frameDocument().documentElement.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
  return '<!DOCTYPE html>\n' + clone.outerHTML;
}
function saveDraft() {
  const html = serializeHtml();
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ html, savedAt: new Date().toISOString() } satisfies DraftPayload));
  setStatus('로컬에 자동저장됨');
  return html;
}
function scheduleAutosave() {
  setStatus('수정 중…');
  if (autosaveTimer !== null) window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => saveDraft(), 500);
}
function setEditing(on: boolean) {
  const doc = frameDocument();
  if (!on && editing) saveDraft();
  editing = on;
  doc.body.contentEditable = on ? 'true' : 'false';
  doc.body.spellcheck = false;
  toggleEditBtn.textContent = on ? '편집 종료' : '편집 시작';
  publishBtn.disabled = false;
  if (on) {
    doc.body.focus();
    setStatus('화면의 문구를 직접 수정 가능');
  } else setStatus('편집 종료 · 임시저장 완료');
}
function attachEditorListeners() {
  const doc = frameDocument();
  doc.addEventListener('input', scheduleAutosave);
  doc.addEventListener('click', event => {
    if (!editing) return;
    const target = event.target as HTMLElement;
    if (target.closest('a')) event.preventDefault();
  }, true);
}
async function updateSignInUi() {
  const user = await auth.getUser();
  signInBtn.textContent = user?.email ? user.email + ' 로그아웃' : '로그인';
}
async function signInOrOut() {
  if (auth.isSignedIn()) {
    await auth.signOut();
    await updateSignInUi();
    showToast('로그아웃됨');
    return;
  }
  try {
    await auth.signIn({ scope: 'openid email profile offline_access' });
    await updateSignInUi();
    showToast('로그인됨');
  } catch (error) {
    const e = error as { code?: string };
    if (e.code === 'popup_blocked') showToast('팝업을 허용한 뒤 다시 로그인해 주세요.');
    else if (e.code !== 'popup_closed') showToast('로그인에 실패했습니다.');
  }
}
async function publishChanges() {
  try {
    if (!auth.isSignedIn()) {
      await auth.signIn({ scope: 'openid email profile offline_access' });
      await updateSignInUi();
    }
    const html = saveDraft();
    publishBtn.disabled = true;
    setStatus('게시 중…');
    await api.put('/api/portfolio', { html });
    localStorage.removeItem(DRAFT_KEY);
    setStatus('게시 완료');
    showToast('같은 공유 URL에 변경사항이 게시됨');
  } catch (error) {
    console.error(error);
    setStatus('게시 실패');
    showToast('게시 권한 또는 로그인 상태를 확인해 주세요.');
  } finally { publishBtn.disabled = false; }
}
function discardDraft() {
  localStorage.removeItem(DRAFT_KEY);
  showToast('로컬 임시저장 삭제됨');
  setStatus('페이지 새로고침 시 게시본으로 복귀');
}
async function boot() {
  toolbar.hidden = !EDIT_MODE;
  if (EDIT_MODE) await updateSignInUi();
  const draft = EDIT_MODE ? getDraft() : null;
  const source = draft?.html ?? (await loadPublishedHtml());
  const html = normalizePortfolioHtml(source);
  frame.srcdoc = html;
  frame.addEventListener('load', () => {
    if (!EDIT_MODE) return;
    attachEditorListeners();
    toggleEditBtn.disabled = false;
    publishBtn.disabled = false;
    setStatus(draft ? '이 브라우저의 임시저장 불러옴' : '게시본 불러옴');
  }, { once: true });
}
signInBtn.addEventListener('click', signInOrOut);
toggleEditBtn.addEventListener('click', () => setEditing(!editing));
publishBtn.addEventListener('click', publishChanges);
discardBtn.addEventListener('click', discardDraft);
boot().catch(error => {
  console.error(error);
  frame.srcdoc = '<!doctype html><html lang="ko"><body style="font-family:sans-serif;padding:40px">포트폴리오를 불러오지 못했습니다.</body></html>';
});
