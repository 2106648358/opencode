## 1. Template command registration

- [x] 1.1 Bridge template engine output to `command.register()` as CommandOption
- [x] 1.2 Set `category: "Templates"` and `slash` on each template command
- [x] 1.3 Handle template add/remove reactivity (re-register on file changes)
- [x] 1.4 Create Templates collapsible section in sidebar (new sidebar_content plugin)

## 2. Variable fill dialog

- [x] 2.1 Implement DialogTemplateFill component (modal with variable inputs)
- [x] 2.2 Wire template click → variable check → dialog open or direct insert
- [x] 2.3 Handle cancel, confirm, and validation in dialog
- [x] 2.4 Emit `TuiEvent.PromptAppend` with substituted text on confirm
