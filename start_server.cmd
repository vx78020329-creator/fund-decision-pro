@echo off
cd /d "C:\Users\86178\Documents\New project\fund-decision"
node --import file:///C:/Users/86178/Documents/New%%20project/fund-decision/node_modules/tsx/dist/loader.mjs server/src/index.ts >> server\backend.log 2>> server\backend_err.log
