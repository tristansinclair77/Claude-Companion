@echo off
cd /d "%~dp0.."

echo.
echo This will DELETE all recent conversation history.
echo Permanent memories (learned facts about you and Aria) are NOT affected.
echo.
set /p CONFIRM=Type YES to confirm:

if /i not "%CONFIRM%"=="YES" (
  echo Cancelled.
  pause
  exit /b
)

echo Clearing conversation history...

echo const Database = require('./node_modules/better-sqlite3'); > _clear_conv_temp.js
echo const db = new Database('./characters/default/knowledge.db'); >> _clear_conv_temp.js
echo const result = db.prepare('DELETE FROM conversation_messages').run(); >> _clear_conv_temp.js
echo db.close(); >> _clear_conv_temp.js
echo console.log('Done. Deleted ' + result.changes + ' messages. Memories untouched.'); >> _clear_conv_temp.js

set ELECTRON_RUN_AS_NODE=1
"node_modules\electron\dist\electron.exe" "_clear_conv_temp.js"
del _clear_conv_temp.js

echo.
pause
