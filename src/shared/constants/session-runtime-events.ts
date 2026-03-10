export const SESSION_RUNTIME_EVENTS = {
    AUTOMATION_STATE_SYNC: 'session:automation:state-sync',
    AUTOMATION_STEP_UPDATE: 'session:automation:step-update',
    AUTOMATION_PLAN_PROPOSED: 'session:automation:plan-proposed',
    AUTOMATION_PLAN_REVISED: 'session:automation:plan-revised',
    AUTOMATION_COST_ESTIMATED: 'session:automation:cost-estimated',
    AUTOMATION_BUDGET_EXCEEDED: 'session:automation:budget-exceeded',
} as const;
