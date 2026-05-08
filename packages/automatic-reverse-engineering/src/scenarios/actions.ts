import { FeatureLocatorLike, FeaturePageLike, FeatureRunContext } from "./feature.js";

export function requirePage(ctx: FeatureRunContext, scenarioId: string): FeaturePageLike {
    if (!ctx.page) {
        throw new Error(`${scenarioId} requires a Playwright-like page on the feature context`);
    }

    return ctx.page;
}

export async function fillRole(ctx: FeatureRunContext, scenarioId: string, role: string, options: Record<string, unknown>, value: string): Promise<void> {
    const detail = optionKeyDetail(options);
    await ctx.recordAction?.({
        action: "fill",
        target: `role:${role}`,
        ...(detail ? { detail } : {}),
        value_redacted: true,
    });
    const locator = requirePage(ctx, scenarioId).getByRole(role, options);
    await fillLocator(locator, scenarioId, role, value);
}

export async function clickRole(ctx: FeatureRunContext, scenarioId: string, role: string, options: Record<string, unknown>): Promise<void> {
    const detail = optionKeyDetail(options);
    await ctx.recordAction?.({
        action: "click",
        target: `role:${role}`,
        ...(detail ? { detail } : {}),
    });
    const locator = requirePage(ctx, scenarioId).getByRole(role, options);
    await clickLocator(locator, scenarioId, role);
}

export async function contextClickRole(ctx: FeatureRunContext, scenarioId: string, role: string, options: Record<string, unknown>): Promise<void> {
    const detail = optionKeyDetail(options);
    await ctx.recordAction?.({
        action: "context-click",
        target: `role:${role}`,
        ...(detail ? { detail } : {}),
    });
    const locator = requirePage(ctx, scenarioId).getByRole(role, options);
    await clickLocator(locator, scenarioId, role, { button: "right" });
}

export async function clickText(ctx: FeatureRunContext, scenarioId: string, text: string | RegExp, options: Record<string, unknown> = {}): Promise<void> {
    const detail = optionKeyDetail(options);
    await ctx.recordAction?.({
        action: "click",
        target: "text",
        ...(detail ? { detail } : {}),
        value_redacted: true,
    });
    const page = requirePage(ctx, scenarioId);
    if (!page.getByText) {
        throw new Error(`${scenarioId} requires page.getByText`);
    }
    await clickLocator(page.getByText(text, options), scenarioId, String(text));
}

export async function contextClickText(ctx: FeatureRunContext, scenarioId: string, text: string | RegExp, options: Record<string, unknown> = {}): Promise<void> {
    const detail = optionKeyDetail(options);
    await ctx.recordAction?.({
        action: "context-click",
        target: "text",
        ...(detail ? { detail } : {}),
        value_redacted: true,
    });
    const page = requirePage(ctx, scenarioId);
    if (!page.getByText) {
        throw new Error(`${scenarioId} requires page.getByText`);
    }
    await clickLocator(page.getByText(text, options), scenarioId, String(text), { button: "right" });
}

export async function contextClickSelector(ctx: FeatureRunContext, scenarioId: string, selector: string): Promise<void> {
    await ctx.recordAction?.({
        action: "context-click",
        target: "selector",
        value_redacted: true,
    });
    const page = requirePage(ctx, scenarioId);
    if (!page.locator) {
        throw new Error(`${scenarioId} requires page.locator`);
    }
    await clickLocator(page.locator(selector), scenarioId, selector, { button: "right" });
}

export async function clickSelector(ctx: FeatureRunContext, scenarioId: string, selector: string): Promise<void> {
    await ctx.recordAction?.({
        action: "click",
        target: "selector",
        value_redacted: true,
    });
    const page = requirePage(ctx, scenarioId);
    if (!page.locator) {
        throw new Error(`${scenarioId} requires page.locator`);
    }
    await clickLocator(page.locator(selector), scenarioId, selector);
}

export async function setInputFilesByLabel(ctx: FeatureRunContext, scenarioId: string, label: string | RegExp, files: string | string[]): Promise<void> {
    await ctx.recordAction?.({
        action: "set-input-files",
        target: "label",
        value_redacted: true,
    });
    const page = requirePage(ctx, scenarioId);
    if (!page.getByLabel) {
        throw new Error(`${scenarioId} requires page.getByLabel`);
    }
    const locator = page.getByLabel(label);
    if (!locator.setInputFiles) {
        throw new Error(`${scenarioId} locator for ${String(label)} does not support setInputFiles`);
    }
    await locator.setInputFiles(files);
}

export async function setInputFilesBySelector(ctx: FeatureRunContext, scenarioId: string, selector: string, files: string | string[]): Promise<void> {
    await ctx.recordAction?.({
        action: "set-input-files",
        target: "selector",
        value_redacted: true,
    });
    const page = requirePage(ctx, scenarioId);
    if (!page.locator) {
        throw new Error(`${scenarioId} requires page.locator`);
    }
    const locator = page.locator(selector);
    if (!locator.setInputFiles) {
        throw new Error(`${scenarioId} locator for ${selector} does not support setInputFiles`);
    }
    await locator.setInputFiles(files);
}

export async function pressKey(ctx: FeatureRunContext, scenarioId: string, key: string): Promise<void> {
    await ctx.recordAction?.({
        action: "press",
        target: "keyboard",
        detail: key,
    });
    await requirePage(ctx, scenarioId).keyboard.press(key);
}

export async function typeText(ctx: FeatureRunContext, scenarioId: string, text: string): Promise<void> {
    await ctx.recordAction?.({
        action: "type",
        target: "keyboard",
        value_redacted: true,
    });
    const keyboard = requirePage(ctx, scenarioId).keyboard;
    if (!keyboard.type) {
        throw new Error(`${scenarioId} requires page.keyboard.type`);
    }
    await keyboard.type(text);
}

async function fillLocator(locator: FeatureLocatorLike, scenarioId: string, description: string, value: string): Promise<void> {
    if (!locator.fill) {
        throw new Error(`${scenarioId} locator for ${description} does not support fill`);
    }
    await locator.fill(value);
}

async function clickLocator(locator: FeatureLocatorLike, scenarioId: string, description: string, options?: Record<string, unknown>): Promise<void> {
    if (!locator.click) {
        throw new Error(`${scenarioId} locator for ${description} does not support click`);
    }
    await locator.click(options);
}

function optionKeyDetail(options: Record<string, unknown>): string | undefined {
    const keys = Object.keys(options).sort();
    return keys.length > 0 ? `options:${keys.join(",")}` : undefined;
}
