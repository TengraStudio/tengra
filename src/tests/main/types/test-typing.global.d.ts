export {};

declare global {
    type TestLooseValue = object | string | number | boolean | symbol | bigint | null | undefined;
    type TestValue = TestLooseValue | TestLooseMock | readonly TestValue[];

    interface TestLooseMock {
        (...args: readonly TestValue[]): TestValue;
        [key: string]: TestLooseMock;
        [index: number]: TestLooseMock;
    }
}
