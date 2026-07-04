import { describe, it, expect } from 'vitest';
import { buildMarkdownCard, buildButtonCard, buildConfirmCard, buildFormCard } from '../src/feishu/card-builder.js';

interface CardElement {
  tag: string;
  [key: string]: unknown;
}

interface CardHeader {
  title: { content: string };
  template?: string;
}

interface CardJson {
  config?: Record<string, unknown>;
  header?: CardHeader;
  elements: CardElement[];
}

describe('card-builder', () => {
  it('builds markdown card', () => {
    const card = buildMarkdownCard('hello world') as unknown as unknown as CardJson;
    expect(card.config).toEqual({ wide_screen_mode: true });
    expect(card.elements).toEqual([{ tag: 'markdown', content: 'hello world' }]);
  });

  it('builds button card', () => {
    const card = buildButtonCard({
      text: 'Choose an option',
      buttons: [
        { text: 'A', value: { action: 'choose_a' }, type: 'primary' },
        { text: 'B', value: { action: 'choose_b' } },
      ],
    }) as unknown as CardJson;
    expect(card.elements).toHaveLength(2);
    expect(card.elements[1]?.tag).toBe('action');
  });

  it('builds confirm card', () => {
    const card = buildConfirmCard({
      title: 'Confirm?',
      description: 'Do you want to proceed?',
      confirmValue: { action: 'confirm', id: '1' },
      rejectValue: { action: 'reject', id: '1' },
    }) as unknown as CardJson;
    expect(card.header?.title.content).toBe('Confirm?');
    const actionElement = card.elements.find((el) => el.tag === 'action');
    expect(actionElement).toBeDefined();
  });

  it('builds form card', () => {
    const card = buildFormCard({
      title: 'Feedback',
      text: 'Please fill in',
      submitValue: { action: 'submit_feedback' },
      inputs: [{ name: 'name', label: 'Name', placeholder: 'Your name' }],
    }) as unknown as CardJson;
    expect(card.header?.title.content).toBe('Feedback');
    const inputElement = card.elements.find((el) => el.tag === 'input');
    expect(inputElement).toBeDefined();
  });
});
