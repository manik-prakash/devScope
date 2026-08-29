import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { TruncationNotice } from '../TruncationNotice'

afterEach(cleanup)

describe('TruncationNotice', () => {
  it('renders nothing when shown is below the limit', () => {
    const { container } = render(<TruncationNotice shown={499} limit={500} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the notice when shown reaches the limit', () => {
    render(<TruncationNotice shown={500} limit={500} />)
    expect(screen.getByText(/most recent 500 sessions/i)).toBeInTheDocument()
  })

  it('respects a custom noun', () => {
    render(<TruncationNotice shown={12} limit={10} noun="results" />)
    expect(screen.getByText(/most recent 10 results/i)).toBeInTheDocument()
  })
})
