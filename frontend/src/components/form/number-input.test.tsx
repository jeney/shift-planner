import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { NumberInput } from './number-input'

function setup(props: Partial<Parameters<typeof NumberInput>[0]> = {}) {
  const onValueChange = vi.fn()
  render(
    <NumberInput
      aria-label="n"
      value={5}
      onValueChange={onValueChange}
      min={0}
      max={10}
      {...props}
    />,
  )
  return { input: screen.getByLabelText('n') as HTMLInputElement, onValueChange }
}

describe('NumberInput', () => {
  it('accepts decimal commas and points', () => {
    const { input, onValueChange } = setup()
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '2,5' } })
    expect(onValueChange).toHaveBeenLastCalledWith(2.5)
    fireEvent.change(input, { target: { value: '7.25' } })
    expect(onValueChange).toHaveBeenLastCalledWith(7.25)
  })

  it('does not commit out-of-range or invalid values and marks them invalid', () => {
    const { input, onValueChange } = setup()
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '11' } })
    fireEvent.change(input, { target: { value: 'abc' } })
    expect(onValueChange).not.toHaveBeenCalled()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    fireEvent.blur(input)
    expect(input.value).toBe('5')
  })

  it('reports null for an empty nullable field', () => {
    const { input, onValueChange } = setup({ nullable: true })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '' } })
    expect(onValueChange).toHaveBeenLastCalledWith(null)
  })

  it('keeps an empty required field invalid without committing', () => {
    const { input, onValueChange } = setup()
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '' } })
    expect(onValueChange).not.toHaveBeenCalled()
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })
})
