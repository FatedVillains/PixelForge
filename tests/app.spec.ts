// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import App from '../src/App.vue'

describe('App bootstrap', () => {
  it('renders brand name', () => {
    const wrapper = mount(App, { global: { plugins: [createPinia()] } })
    expect(wrapper.text()).toContain('PixelForge')
  })
})
