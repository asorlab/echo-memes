' ECHO // Creator OS: liga o worker de producao escondido (sem janela).
' Para ligar junto com o Windows: Win+R, shell:startup, e cole um atalho para este arquivo.
' O registro fica em echo-worker.log, na pasta do echo-memes.
Set fso = CreateObject("Scripting.FileSystemObject")
pasta = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = pasta
shell.Run "cmd.exe /c node scripts\echo-worker.mjs >> echo-worker.log 2>&1", 0, False
