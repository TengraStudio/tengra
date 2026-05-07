/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const SESSION_RUNTIME_EVENTS = {
    AUTOMATION_STATE_SYNC: 'session:automation:state-sync',
    AUTOMATION_STEP_UPDATE: 'session:automation:step-update',
    AUTOMATION_PLAN_PROPOSED: 'session:automation:plan-proposed',
    AUTOMATION_PLAN_REVISED: 'session:automation:plan-revised',
    AUTOMATION_COST_ESTIMATED: 'session:automation:cost-estimated',
    AUTOMATION_BUDGET_EXCEEDED: 'session:automation:budget-exceeded',
} as const;

