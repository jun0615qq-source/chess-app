@echo off
cd /d C:\Users\jun06\chess-app\server
node_modules\.bin\ts-node-dev.cmd --respawn --transpile-only src/index.ts
