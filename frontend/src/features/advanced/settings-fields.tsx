import { useId, type ComponentProps } from 'react'

import { Field } from '@/components/form/field'
import { NumberInput } from '@/components/form/number-input'

type NumberProps = Omit<ComponentProps<typeof NumberInput>, 'id'>

interface NumberSettingProps extends NumberProps {
  label: string
  help: string
}

/** Labelled number setting with help text. */
export function NumberSetting({ label, help, className, ...props }: NumberSettingProps) {
  const id = useId()
  return (
    <Field label={label} help={help} htmlFor={id} className={className}>
      <NumberInput id={id} className="max-w-40" {...props} />
    </Field>
  )
}
