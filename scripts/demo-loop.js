// Generated from workflow "Demo loop and condition" (demo-loop).
// Block edits overwrite this file. You can still edit it and run JS mode
// until the next block save. ctx provides text, step, pace, vars, csv, loop,
// testCondition, readCsv, screenshot, log, and evalVars.

export async function runWorkflow(page, ctx) {
  // openUrl
  await ctx.step("open-demo", "openUrl", async () => {
    await page.goto(ctx.text("http://127.0.0.1:3789/fixture/demo.html"), { waitUntil: 'domcontentloaded' });
  });
  // Click while Next is visible
  {
    const __times = Number(ctx.text("3"));
    if (__times > 10000) throw new Error('loopTimes refuses more than 10000 iterations');
    for (let __i = 1; __i <= __times; __i++) {
      ctx.vars["i"] = __i;
      ctx.vars.loopIndex = __i;
      // ifCondition
      if (await ctx.testCondition({"op":"elementVisible","selector":"#next","timeoutMs":800})) {
        // openUrl
        await ctx.step("bb337bb8-e4be-4a7c-b807-3c813bc062be", "openUrl", async () => {
          await page.goto(ctx.text("https://example.com"), { waitUntil: 'domcontentloaded' });
        });
        // openUrl
        await ctx.step("3054d96b-3083-4943-aefc-db54513f5f4f", "openUrl", async () => {
          await page.goto(ctx.text("https://example.com"), { waitUntil: 'domcontentloaded' });
        });
        // click
        await ctx.step("click-next", "click", async () => {
          await page.locator(ctx.text("#next")).click();
        });
        // extractText
        await ctx.step("read-count", "extractText", async () => {
          const text = (await page.locator(ctx.text("#count")).innerText()).trim();
          ctx.vars["count"] = text;
        });
      } else {
        // breakLoop
        break;
      }
    }
  }
}
