import { Toggle } from '@/components/ui/Toggle';

interface TaskToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function TaskToggle({ checked, onChange }: TaskToggleProps) {
  return <Toggle label="Task mode" checked={checked} onChange={onChange} />;
}
