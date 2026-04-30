# Stockfish WebAssembly 설정

게임 분석 기능을 위해 Stockfish WASM 파일이 필요합니다.

## 설치 방법

1. Stockfish WASM 빌드를 다운로드합니다:
   https://github.com/lichess-org/stockfish.wasm/releases

2. 다운로드한 `stockfish.js`와 `stockfish.wasm` 파일을 이 디렉토리(`/public`)에 복사합니다.

3. 또는 npm 패키지 사용:
   ```
   npm install stockfish
   cp node_modules/stockfish/src/stockfish.js public/
   cp node_modules/stockfish/src/stockfish.wasm public/
   ```

Stockfish 파일이 없으면 리뷰 페이지의 엔진 분석 기능이 비활성화됩니다.
