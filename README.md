# Playwright Visual RPA Studio

Local studio for browser automation. You build a workflow by dragging nested action blocks (clicks, inputs, loops, and if/else), or you record the actions in a real Chromium window. The same workflow is saved as editable Playwright JavaScript and can be replayed with pacing, CSV rows, and a proxy per loop.

This project sits next to Ui.Vision and borrows its control-flow ideas (`if` / `else`, `times`, `while`, `forEach`, `break`) plus recording and `!LOOP`-style outer repeats. Execution goes through Playwright instead of a browser extension.

## Run

Requires Node.js 20+.

```bash
cd playwright-rpa
npm install
npx playwright install chromium
npm run dev
```

Open http://localhost:5173. The API listens on http://127.0.0.1:3789.

- **Play** runs the open workflow. Choose **Visual blocks** or **Edited JS file**.
- **Record** opens Chromium, highlights elements, and appends actions to the selected loop or to the end of the workflow.
- **From / To loop** repeats the whole workflow. Loop 1 reads CSV row 1 when a CSV file is selected. **On error in loop** can stop or continue.
- **Interval** and **Random jitter** pause between actions (`ctx.pace()`), which is the practical control for not hitting a site as fast as possible.
- **Proxy**: off, one proxy, or a pool that rotates onto a new browser context each outer loop. `http`, `https`, `socks4`, and `socks5` URLs are accepted (`http://user:pass@host:port`).
- **Persistent profile** keeps cookies between runs. It is not used while proxies rotate.
- The **JavaScript** tab shows the generated script. **Detach and edit** to change it by hand and run that file. Block saves overwrite the script again until you reset it.
- `${name}`, `${loop}`, and `${csv.column}` are filled in when an action runs.

Sample workflow `demo-loop` opens `server/fixtures/demo.html`, clicks **Next** while it is visible, and breaks out of the loop when it disappears. `data/users.csv` is the sample table.

## Checks

```bash
npm run build
npm run smoke
```

`smoke` compiles a nested loop/if workflow to JavaScript, runs that workflow both as blocks and as the generated script, and checks that recorded clicks and typing become action blocks.

## Layout

- `shared/` — block tree, variable interpolation, proxy parsing, JavaScript generator
- `server/` — Express, WebSocket, Playwright context, block runner, script runner, recorder
- `web/` — React studio (nested drag-and-drop, inspector, code editor, live log)
- `workflows/`, `scripts/`, `data/` — saved workflows, generated or edited scripts, CSV files

## Tiếng Việt

Studio local để tự động hóa trình duyệt. Kéo thả các khối (bấm, nhập, vòng lặp, if/else) hoặc bấm **Record** để ghi thao tác trên Chromium. Workflow được lưu thành file JavaScript của Playwright, sửa được, rồi chạy lại.

```bash
cd playwright-rpa
npm install
npx playwright install chromium
npm run dev
```

Mở http://localhost:5173.

- **Play** chạy khối hoặc file JS đã sửa.
- **Record** ghi click / nhập / chọn và gắn vào vòng lặp đang chọn, hoặc vào cuối workflow.
- **From / To loop** lặp cả workflow. Vòng `N` dùng dòng CSV `N`. Có delay và jitter giữa các thao tác.
- **Proxy** tắt, một proxy, hoặc xoay proxy mỗi vòng (mỗi vòng một browser context).
- Tab **JavaScript** là code sinh ra từ khối. **Detach and edit** để sửa tay. Lưu khối sẽ ghi đè file cho đến khi bạn bấm reset.
- Biến: `${tên}`, `${loop}`, `${csv.tên_cột}`.

`npm run smoke` kiểm tra sinh JS, chạy vòng lặp có điều kiện, và ghi thao tác thành khối.
