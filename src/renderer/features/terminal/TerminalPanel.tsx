import type { TerminalPanelProps } from './TerminalPanelImpl';
import { TerminalPanel as TerminalPanelImpl } from './TerminalPanelImpl';

export function TerminalPanel(props: TerminalPanelProps) {
    return <TerminalPanelImpl {...props} />;
}
