#!/usr/bin/env node
/**
 * AntiSurge — Pre-Deploy Validator v3 (모듈 분리 대응)
 * 사용: node validate.js [--strict]
 */

'use strict';
const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const STRICT = process.argv.includes('--strict');
const ROOT   = __dirname;
const SRC    = path.join(ROOT, 'src');

let errors   = [];
let warnings = [];
let passed   = [];

function err(file, line, msg)  { errors.push(`  ❌ [${file}:${line}] ${msg}`); }
function warn(file, line, msg) { warnings.push(`  ⚠️  [${file}:${line}] ${msg}`); }
function ok(msg)               { passed.push(`  ✅ ${msg}`); }

// ── 파일 읽기 ──────────────────────────────────────────
const INDEX_HTML = path.join(ROOT, 'index.html');
if (!fs.existsSync(INDEX_HTML)) { console.error('❌ index.html 없음'); process.exit(1); }
if (!fs.existsSync(SRC))        { console.error('❌ src/ 디렉토리 없음'); process.exit(1); }

// src/*.js 로딩 순서 (index.html과 동일)
const MODULE_ORDER = [
  'config.js','audio.js','player.js','weapons.js','projectiles.js',
  'enemies.js','entities.js','stage.js','flow.js','loop.js',
  'upgrades.js','endgame.js','extras.js','input.js','multiplayer.js'
];

// 각 파일 읽기 + 전체 합본 생성
const modules = MODULE_ORDER.map(name => {
  const fpath = path.join(SRC, name);
  if (!fs.existsSync(fpath)) { console.error(`❌ src/${name} 없음`); process.exit(1); }
  const lines = fs.readFileSync(fpath, 'utf8').split('\n');
  return { name: `src/${name}`, fpath, lines };
});

// 검사용: 전체 합본 + 각 줄이 어느 파일의 몇 번째 줄인지 맵
const allLines = [];   // 합본 줄 배열
const lineMap  = [];   // allLines[i] → { file, localLine }
for (const mod of modules) {
  mod.startLine = allLines.length; // 합본 내 시작 인덱스
  for (let j = 0; j < mod.lines.length; j++) {
    allLines.push(mod.lines[j]);
    lineMap.push({ file: mod.name, localLine: j + 1 });
  }
}
const allText = allLines.join('\n');
const htmlText  = fs.readFileSync(INDEX_HTML, 'utf8');
const htmlLines = htmlText.split('\n');

function fileOf(i)  { return lineMap[i]?.file || '?'; }
function lnOf(i)    { return lineMap[i]?.localLine || 0; }

// ──────────────────────────────────────────────────────────────
// 검사 1: 인덱스 루프 내 사망 유발 직접 호출
// ──────────────────────────────────────────────────────────────
console.log('🔍 [1] 인덱스 루프 내 사망 유발 직접 호출 검사...');
const DANGEROUS_ARRAYS = new Set(['enemies','mines','blackHoles','bossProjectiles']);
let braceDepth = 0, inLoop = false, loopArr = '', loopDepth = 0;

for (let i = 0; i < allLines.length; i++) {
  const line = allLines[i];
  const m = line.match(/for\s*\(let\s+i\s*=\s*(\w+)\.length\s*-\s*1/);
  if (m) { loopArr = m[1]; inLoop = true; loopDepth = braceDepth; }
  braceDepth += (line.match(/\{/g)||[]).length - (line.match(/\}/g)||[]).length;
  if (inLoop && braceDepth <= loopDepth) { inLoop = false; loopArr = ''; }

  if (inLoop && DANGEROUS_ARRAYS.has(loopArr)) {
    if (new RegExp(`${loopArr}\\[i\\]\\.takeDamage`).test(line))
      err(fileOf(i), lnOf(i), `${loopArr}[i].takeDamage() — 루프 중 스테이지클리어 유발 가능`);
    if (new RegExp(`${loopArr}\\[i\\]\\.die\\(`).test(line))
      err(fileOf(i), lnOf(i), `${loopArr}[i].die() — 루프 중 스테이지클리어 유발 가능`);
  }
}
if (!errors.some(e => e.includes('takeDamage'))) ok('인덱스 루프 내 직접 사망 호출 — 안전');

// ──────────────────────────────────────────────────────────────
// 검사 2: 전역 배열 재할당 (= [])
// ──────────────────────────────────────────────────────────────
console.log('🔍 [2] 전역 배열 재할당 검사...');
const GLOBAL_ARRS     = ['enemies','projectiles','mines','blackHoles','gems','particles','bossProjectiles','fieldItems','goldCoins'];
const SAFE_FN_MARKERS = ['function startGame','function resetGame','function initGame'];

for (let i = 0; i < allLines.length; i++) {
  const line = allLines[i];
  for (const arr of GLOBAL_ARRS) {
    if (!new RegExp(`^\\s*${arr}\\s*=\\s*\\[\\]`).test(line)) continue;
    if (/^\s*(let|var|const)\s/.test(line)) continue;
    const ctx = allLines.slice(Math.max(0, i-80), i).join('\n');
    if (SAFE_FN_MARKERS.some(mk => ctx.includes(mk))) continue;
    err(fileOf(i), lnOf(i), `${arr} = [] — 게임 진행 중 재할당 위험. .length = 0 사용 필요`);
  }
}
if (!errors.some(e => e.includes('= []'))) ok('전역 배열 재할당 — 안전');

// ──────────────────────────────────────────────────────────────
// 검사 3: for..of 루프 중 원본 배열 직접 splice
// ──────────────────────────────────────────────────────────────
console.log('🔍 [3] for..of 루프 중 직접 splice 검사...');
let inForOf = false, forOfArr = '', foDepth = 0, foStart = 0;
for (let i = 0; i < allLines.length; i++) {
  const line = allLines[i];
  const fm = line.match(/for\s*\((?:const|let)\s+\w+\s+of\s+(\w+)\s*\)/);
  if (fm && !line.includes('[...')) { inForOf = true; forOfArr = fm[1]; foDepth = 0; foStart = i; }
  if (inForOf) {
    foDepth += (line.match(/\{/g)||[]).length - (line.match(/\}/g)||[]).length;
    if (foDepth <= 0 && i > foStart) { inForOf = false; forOfArr = ''; }
    if (inForOf && DANGEROUS_ARRAYS.has(forOfArr))
      if (new RegExp(`${forOfArr}\\.splice\\(`).test(line))
        err(fileOf(i), lnOf(i), `for..of ${forOfArr} 루프 중 .splice() — [...${forOfArr}] 스냅샷 필요`);
  }
}
ok('for..of 루프 splice 검사 완료');

// ──────────────────────────────────────────────────────────────
// 검사 4: 무기 update() 호출부 보호
// ──────────────────────────────────────────────────────────────
console.log('🔍 [4] 무기 update() 호출 보호 검사...');
const callProtected = allLines.some(l =>
  /level\s*>\s*0.*update|\.level.*>\s*0.*this\.\w+\.update/.test(l)
);
if (callProtected) ok('무기 update() — 호출부에서 level>0 가드 확인');
else warn('src/player.js', 0, '무기 update() 호출부에서 level>0 체크 없음 — 개별 가드 필요');

// ──────────────────────────────────────────────────────────────
// 검사 5: STATE 전환 유효성
// ──────────────────────────────────────────────────────────────
console.log('🔍 [5] 게임 STATE 전환 유효성 검사...');
const VALID_STATES = new Set([
  'STATE_MENU','STATE_PLAYING','STATE_LEVEL_UP','STATE_STAGE_CLEAR',
  'STATE_STAGE_BONUS','STATE_GAME_OVER','STATE_SHOP','STATE_PAUSED','STATE_CURSE'
]);
for (let i = 0; i < allLines.length; i++) {
  const m = allLines[i].match(/gameState\s*=\s*(STATE_\w+)/);
  if (m && !VALID_STATES.has(m[1]))
    err(fileOf(i), lnOf(i), `알 수 없는 gameState 값: ${m[1]}`);
}
ok('STATE 전환 유효성 — 안전');

// ──────────────────────────────────────────────────────────────
// 검사 6: 핵심 모달 닫기 후 게임루프 재시작
// ──────────────────────────────────────────────────────────────
console.log('🔍 [6] 핵심 모달 닫기 후 게임루프 재시작 검사...');
const GAMEPLAY_CLOSE_FNS = ['closeLevelUpModal','closeShopModal','applyCurseChoice','applyNearDeathCurseChoice'];
for (const fn of GAMEPLAY_CLOSE_FNS) {
  const fnIdx = allLines.findIndex(l => new RegExp(`function\\s+${fn}\\b`).test(l));
  if (fnIdx < 0) { warn('?', 0, `${fn} 함수를 찾을 수 없음`); continue; }
  let depth = 0, body = '';
  for (let i = fnIdx; i < Math.min(fnIdx+50, allLines.length); i++) {
    const l = allLines[i];
    depth += (l.match(/\{/g)||[]).length - (l.match(/\}/g)||[]).length;
    body += l + '\n';
    if (depth <= 0 && i > fnIdx) break;
  }
  if (body.includes('ensureGameLoopRunning') || /gameState\s*=\s*STATE_/.test(body))
    passed.push(`  ✅ ${fn} — 게임 상태 전환 또는 루프 재시작 있음`);
  else
    err(fileOf(fnIdx), lnOf(fnIdx), `${fn}: gameState 전환 및 ensureGameLoopRunning() 모두 없음`);
}

// ──────────────────────────────────────────────────────────────
// 검사 7: activeBoss 직접 접근 안전성
// ──────────────────────────────────────────────────────────────
console.log('🔍 [7] activeBoss 직접 접근 안전성 검사...');
let bossUnsafe = 0;
for (let i = 0; i < allLines.length; i++) {
  const line = allLines[i];
  if (!/activeBoss\.[a-zA-Z]/.test(line) || /\/\//.test(line)) continue;
  if (/if\s*\(\s*activeBoss|e\s*===\s*activeBoss|activeBoss\s*&&|activeBoss\s*\?\./.test(line)) continue;
  const prev8 = allLines.slice(Math.max(0, i-8), i).join('\n');
  if (/if\s*\(\s*activeBoss|e\s*===\s*activeBoss|activeBoss\s*&&|&&\s*activeBoss/.test(prev8)) continue;
  bossUnsafe++;
  if (bossUnsafe <= 3) warn(fileOf(i), lnOf(i), `activeBoss.* — null 체크 없음`);
}
if (bossUnsafe === 0) ok('activeBoss 접근 — 안전');
else if (bossUnsafe > 3) warn('?', 0, `activeBoss 미보호 접근 추가 ${bossUnsafe-3}곳`);

// ──────────────────────────────────────────────────────────────
// 검사 8: HTML ID 참조
// ──────────────────────────────────────────────────────────────
console.log('🔍 [8] HTML ID 참조 검사...');
const referencedIds = new Map();
for (const m of [...allText.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)]) {
  if (!referencedIds.has(m[1])) {
    const gIdx = allText.substring(0, m.index).split('\n').length - 1;
    referencedIds.set(m[1], { file: fileOf(gIdx), line: lnOf(gIdx) });
  }
}
const dynamicIds = new Set([...allText.matchAll(/\.id\s*=\s*['"]([^'"]+)['"]/g)].map(m => m[1]));
const existingIds = new Set([...htmlText.matchAll(/id=["']([^"']+)["']/g)].map(m => m[1]));

let missingHtml = 0;
for (const [id, loc] of referencedIds) {
  if (existingIds.has(id) || dynamicIds.has(id)) continue;
  err('index.html', `${loc.file}:${loc.line}`, `#${id} — HTML에 없고 동적 생성도 없음`);
  missingHtml++;
}
if (missingHtml === 0) ok(`HTML ID 참조 ${referencedIds.size}개 — 모두 정상`);

// ──────────────────────────────────────────────────────────────
// 검사 9: JavaScript 문법 (각 파일 개별 검사)
// ──────────────────────────────────────────────────────────────
console.log('🔍 [9] JavaScript 문법 검사...');
let syntaxErrors = 0;
for (const mod of modules) {
  try {
    execSync(`node --check "${mod.fpath}"`, { stdio: 'pipe' });
  } catch (e) {
    const msg = (e.stderr||'').toString().trim() || e.message;
    err(mod.name, 0, `문법 오류: ${msg}`);
    syntaxErrors++;
  }
}
if (syntaxErrors === 0) ok(`모든 src/*.js 문법 정상 (${modules.length}개 파일)`);

// ──────────────────────────────────────────────────────────────
// 검사 10: setTimeout 내 player 접근 안전성
// ──────────────────────────────────────────────────────────────
console.log('🔍 [10] setTimeout 내 player 접근 검사...');
let stPos = -1, stDepth2 = 0, stUnsafe = 0;
for (let i = 0; i < allLines.length; i++) {
  const line = allLines[i];
  if (/setTimeout\s*\(/.test(line) && /=>|\bfunction\b/.test(line)) { stPos = i; stDepth2 = 0; }
  if (stPos >= 0) {
    stDepth2 += (line.match(/\{/g)||[]).length - (line.match(/\}/g)||[]).length;
    if (stDepth2 <= 0 && i > stPos) {
      const block = allLines.slice(stPos, i+1).join('\n');
      if (/player\.[a-zA-Z]/.test(block) && !/if\s*\(!?\s*player/.test(block) && !/player\?\./.test(block)) {
        stUnsafe++;
        if (stUnsafe <= 3) warn(fileOf(stPos), lnOf(stPos), `setTimeout 내 player.* 접근 — null 체크 권장`);
      }
      stPos = -1;
    }
  }
}
if (stUnsafe === 0) ok('setTimeout 콜백 — 안전');
else if (stUnsafe > 3) warn('?', 0, `setTimeout player 미보호 추가 ${stUnsafe-3}곳`);

// ──────────────────────────────────────────────────────────────
// 검사 11: mines/blackHoles 루프 경계 체크
// ──────────────────────────────────────────────────────────────
console.log('🔍 [11] mines/blackHoles 루프 경계 체크 검사...');
const mineLoopIdx = allLines.findIndex(l => /for.*mines\.length.*-.*1/.test(l));
if (mineLoopIdx >= 0) {
  const block = allLines.slice(mineLoopIdx, mineLoopIdx+10).join('\n');
  if (/i\s*>=\s*mines\.length/.test(block)) ok('mines 루프 — 경계 체크 있음');
  else err(fileOf(mineLoopIdx), lnOf(mineLoopIdx), 'mines 루프 경계 체크 없음 (stage-clear 크래시 위험)');
}
const bhLoopIdx = allLines.findIndex(l => /for.*blackHoles\.length.*-.*1/.test(l));
if (bhLoopIdx >= 0) {
  const block = allLines.slice(bhLoopIdx, bhLoopIdx+10).join('\n');
  if (/i\s*>=\s*blackHoles\.length/.test(block)) ok('blackHoles 루프 — 경계 체크 있음');
  else err(fileOf(bhLoopIdx), lnOf(bhLoopIdx), 'blackHoles 루프 경계 체크 없음 (stage-clear 크래시 위험)');
}

// ──────────────────────────────────────────────────────────────
// 검사 12: 파일 크기
// ──────────────────────────────────────────────────────────────
console.log('🔍 [12] 파일 크기 검사...');
let totalKB = 0;
for (const mod of modules) {
  const kb = Math.round(fs.statSync(mod.fpath).size / 1024);
  totalKB += kb;
  if (kb > 200) warn(mod.name, 0, `${kb}KB — 재분할 고려`);
}
const htmlKB = Math.round(fs.statSync(INDEX_HTML).size / 1024);
ok(`src/ 합계 ${totalKB}KB (${modules.length}개 파일), index.html ${htmlKB}KB`);

// ──────────────────────────────────────────────────────────────
// 검사 13: TODO/FIXME 주석
// ──────────────────────────────────────────────────────────────
console.log('🔍 [13] 미완성 주석 검사...');
let todoCount = 0;
for (let i = 0; i < allLines.length; i++) {
  if (/\/\/\s*(TODO|FIXME|HACK|XXX|BUG)\b/i.test(allLines[i])) {
    todoCount++;
    if (STRICT) warn(fileOf(i), lnOf(i), `미완성 주석: ${allLines[i].trim()}`);
  }
}
if (todoCount === 0) ok('TODO/FIXME 주석 없음');
else ok(`TODO/FIXME ${todoCount}개 (--strict 에서 위치 표시)`);

// ──────────────────────────────────────────────────────────────
// 결과 출력
// ──────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(60));
console.log('📋 검증 결과');
console.log('═'.repeat(60));

if (STRICT && passed.length > 0) {
  console.log(`\n✅ 통과 (${passed.length}개):`);
  passed.forEach(p => console.log(p));
} else if (passed.length > 0) {
  console.log(`\n✅ ${passed.length}개 항목 통과`);
}
if (warnings.length > 0) {
  console.log(`\n⚠️  경고 (${warnings.length}개):`);
  warnings.forEach(w => console.log(w));
}
if (errors.length > 0) {
  console.log(`\n❌ 오류 (${errors.length}개) — 배포 불가:`);
  errors.forEach(e => console.log(e));
}

console.log('\n' + '─'.repeat(60));
if (errors.length === 0 && warnings.length === 0) {
  console.log('🎉 모든 검사 통과! 배포 준비 완료.');
} else if (errors.length === 0) {
  console.log(`⚠️  경고 ${warnings.length}개. 검토 후 배포하세요.`);
} else {
  console.log(`💥 오류 ${errors.length}개 발견. 수정 후 배포하세요.`);
}
console.log('─'.repeat(60) + '\n');

process.exit(errors.length > 0 ? 1 : 0);
