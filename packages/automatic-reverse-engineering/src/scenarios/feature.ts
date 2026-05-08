import { FeatureDefinition, UiActionDetails } from "../types.js";

export interface FeatureLocatorLike {
    fill?(value: string): Promise<void>;
    click?(options?: Record<string, unknown>): Promise<void>;
    setInputFiles?(files: string | string[]): Promise<void>;
    waitFor?(options?: Record<string, unknown>): Promise<unknown>;
    first?(): FeatureLocatorLike;
    nth?(index: number): FeatureLocatorLike;
}

export interface FeaturePageLike {
    getByRole(role: string, options?: Record<string, unknown>): FeatureLocatorLike;
    getByLabel?(text: string | RegExp, options?: Record<string, unknown>): FeatureLocatorLike;
    getByText?(text: string | RegExp, options?: Record<string, unknown>): FeatureLocatorLike;
    locator?(selector: string): FeatureLocatorLike;
    keyboard: {
        press(key: string): Promise<void>;
        type?(text: string): Promise<void>;
    };
}

export interface FeatureRunContext {
    step<T>(stepId: string, title: string, run: () => Promise<T>): Promise<T>;
    fixture(fixturePath: string): string;
    gotoChannel(name: string): Promise<void>;
    expectReady(): Promise<void>;
    expectNetwork(expectation: { method: string; route: string; timeoutMs?: number }): Promise<void>;
    expectGateway(expectation: { direction: "sent" | "received"; event?: string; opcode?: number; timeoutMs?: number }): Promise<void>;
    recordAction?(action: UiActionDetails): Promise<void> | void;
    page?: FeaturePageLike;
    run_id: string;
}

export interface FeatureScenario extends FeatureDefinition {
    run(ctx: FeatureRunContext): Promise<void>;
}

export function defineFeature(scenario: FeatureScenario): FeatureScenario {
    return scenario;
}
