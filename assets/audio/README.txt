Suno BGM 교체 방법
-------------------
1. Suno에서 생성한 MP3 파일을 이 폴더에 'bgm.mp3' 이름으로 저장
2. game.js 최상단의 BGM_AUDIO_SRC 값을 아래와 같이 변경:

   const BGM_AUDIO_SRC = 'assets/audio/bgm.mp3';

3. 저장 후 새로고침 - 신스 BGM 대신 MP3가 재생됩니다.

주의: 브라우저 자동재생 정책상 첫 화면 클릭(게임 시작) 이후 재생됩니다.
