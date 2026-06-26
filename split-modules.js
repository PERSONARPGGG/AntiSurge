#!/usr/bin/env node
/**
 * AntiSurge — game.js → src/*.js 모듈 분리 스크립트
 * 실행: node split-modules.js
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT    = __dirname;
const GAME_JS = path.join(ROOT, 'game.js');
const SRC_DIR = path.join(ROOT, 'src');

if (!fs.existsSync(GAME_JS)) { console.error('game.js 없음'); process.exit(1); }

const lines = fs.readFileSync(GAME_JS, 'utf8').split('\n');
const total = lines.length;

console.log(`📄 game.js: ${total}줄`);

fs.mkdirSync(SRC_DIR, { recursive: true });

// [start, end] 는 1-based, inclusive
const modules = [
  // 파일명                    시작   끝     설명
  ['config.js',       1,     938,  '전역 상수 + 상태 선언'],
  ['audio.js',        939,   1445, 'Web Audio + BGM + 스킬/난이도/저장 유틸'],
  ['player.js',       1446,  1925, 'Player 클래스'],
  ['weapons.js',      1926,  2678, '무기 클래스들'],
  ['projectiles.js',  2679,  2852, '투사체 + 레이저 + 보스 위험물'],
  ['enemies.js',      2853,  3737, 'Enemy + Boss 클래스'],
  ['entities.js',     3738,  3997, 'FieldItem, Gem, Particle 등'],
  ['stage.js',        3998,  4936, '스테이지/콤보/저장/스폰/충돌/배경'],
  ['flow.js',         4937,  5363, '게임 라이프사이클, showScreen, startGame'],
  ['loop.js',         5364,  5979, 'gameLoop, update, draw, HUD, minimap'],
  ['upgrades.js',     5980,  6648, '레벨업, 상점, 저주, 시너지, 업그레이드'],
  ['endgame.js',      6649,  7005, '게임 종료, 빅토리, NG+, 전체화면, 공유'],
  ['extras.js',       7006,  7217, '개발자 패널, 필드 이벤트'],
  ['input.js',        7218,  7393, '터치, 유틸(dist), 설정, 초대 모달'],
  ['multiplayer.js',  7394,  total,'멀티플레이어, 리더보드, 초기화'],
];

let covered = 0;
for (const [name, start, end, desc] of modules) {
  const slice = lines.slice(start - 1, end);
  const content = slice.join('\n');
  const outPath = path.join(SRC_DIR, name);
  fs.writeFileSync(outPath, content);
  covered += slice.length;
  console.log(`  ✓ src/${name.padEnd(18)} [${String(start).padStart(5)}-${String(end).padStart(5)}]  ${slice.length}줄  — ${desc}`);
}

// 검증
if (covered !== total) {
  console.warn(`\n⚠️  라인 수 불일치: 원본=${total}, 분리합계=${covered}`);
} else {
  console.log(`\n✅ 총 ${total}줄 → src/ ${modules.length}개 파일로 분리 완료`);
}

// 원본 백업
const backup = path.join(ROOT, 'game.js.bak');
fs.copyFileSync(GAME_JS, backup);
console.log(`📦 원본 백업: game.js.bak`);
