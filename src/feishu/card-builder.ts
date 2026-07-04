export interface CardButton {
  text: string;
  value: Record<string, unknown>;
  type?: 'primary' | 'danger' | 'default';
}

export function buildMarkdownCard(text: string): Record<string, unknown> {
  return {
    config: { wide_screen_mode: true },
    elements: [
      {
        tag: 'markdown',
        content: text,
      },
    ],
  };
}

export function buildButtonCard(params: {
  text?: string;
  buttons: CardButton[];
}): Record<string, unknown> {
  const elements: Array<Record<string, unknown>> = [];
  if (params.text) {
    elements.push({ tag: 'markdown', content: params.text });
  }

  elements.push({
    tag: 'action',
    actions: params.buttons.map((b) => ({
      tag: 'button',
      text: { tag: 'plain_text', content: b.text },
      type: b.type ?? 'default',
      value: b.value,
    })),
  });

  return {
    config: { wide_screen_mode: true },
    elements,
  };
}

export function buildConfirmCard(params: {
  title?: string;
  description: string;
  confirmText?: string;
  rejectText?: string;
  confirmValue: Record<string, unknown>;
  rejectValue: Record<string, unknown>;
}): Record<string, unknown> {
  const elements: Array<Record<string, unknown>> = [
    {
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: params.description,
      },
    },
    { tag: 'hr' },
    {
      tag: 'action',
      actions: [
        {
          tag: 'button',
          text: { tag: 'plain_text', content: params.confirmText ?? '确认' },
          type: 'primary',
          value: params.confirmValue,
        },
        {
          tag: 'button',
          text: { tag: 'plain_text', content: params.rejectText ?? '取消' },
          type: 'danger',
          value: params.rejectValue,
        },
      ],
    },
  ];

  const card: Record<string, unknown> = {
    config: { wide_screen_mode: true },
    elements,
  };

  if (params.title) {
    card.header = {
      title: { tag: 'plain_text', content: params.title },
      template: 'orange',
    };
  }

  return card;
}

export function buildFormCard(params: {
  title?: string;
  text?: string;
  submitValue: Record<string, unknown>;
  inputs: Array<{
    name: string;
    label: string;
    placeholder?: string;
    defaultValue?: string;
  }>;
}): Record<string, unknown> {
  const elements: Array<Record<string, unknown>> = [];
  if (params.text) {
    elements.push({ tag: 'markdown', content: params.text });
  }

  for (const input of params.inputs) {
    elements.push({
      tag: 'input',
      name: input.name,
      placeholder: {
        tag: 'plain_text',
        content: input.placeholder ?? input.label,
      },
      value: input.defaultValue ?? '',
      label: {
        tag: 'plain_text',
        content: input.label,
      },
    });
  }

  elements.push({
    tag: 'action',
    actions: [
      {
        tag: 'button',
        text: { tag: 'plain_text', content: '提交' },
        type: 'primary',
        value: params.submitValue,
      },
    ],
  });

  const card: Record<string, unknown> = {
    config: { wide_screen_mode: true },
    elements,
  };

  if (params.title) {
    card.header = {
      title: { tag: 'plain_text', content: params.title },
      template: 'blue',
    };
  }

  return card;
}
