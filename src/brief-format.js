export const fieldLabels = {
  contactName: 'Имя / должность',
  contactPhone: 'Телефон или Telegram',
  q1_name: 'Название клиники',
  q2_logo: 'Готовый логотип',
  q2_logo_link: 'Ссылка на логотип',
  q3_colors: 'Фирменные цвета',
  q4_type: 'Тип сайта',
  q4_type_other: 'Уточнение типа сайта',
  q5_services: 'Услуги и цены',
  q6_photos: 'Фото клиники/специалистов',
  q7_before_after: 'Фото до/после',
  q8_cases: 'Парные кейсы до/после',
  q9_reviews: 'Отзывы клиентов',
  q10_contacts: 'Контакты',
  q11_domain: 'Домен и хостинг',
  q_feat_other: 'Своя функция',
  q12_deadline: 'Желаемый срок',
  q13_examples: 'Примеры сайтов',
  q14_other: 'Прочие пожелания',
  features: 'Выбранные доп. функции'
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function labelsFor(record) {
  return {
    ...fieldLabels,
    ...(record.payload?._fieldLabels || {})
  };
}

function valueToText(value) {
  return Array.isArray(value) ? value.join('\n') : value;
}

function orderedEntries(record) {
  const payload = record.payload || {};
  const labels = labelsFor(record);
  const keys = [...Object.keys(labels), ...Object.keys(payload)];
  const seen = new Set();

  return keys
    .filter((key) => {
      if (key.startsWith('_') || seen.has(key)) return false;
      seen.add(key);
      const value = payload[key];
      return value && (!Array.isArray(value) || value.length > 0);
    })
    .map((key) => [key, labels[key] || key, valueToText(payload[key])]);
}

export function renderBriefText(record) {
  const lines = [
    `Новая анкета: ${record.clinicName}`,
    `Дата отправки: ${new Date(record.submittedAt).toLocaleString('ru-RU')}`,
    ''
  ];

  orderedEntries(record).forEach(([, label, value]) => {
    lines.push(`${label}: ${value}`);
  });

  return lines.join('\n');
}

export function renderBriefHtml(record) {
  const rows = orderedEntries(record)
    .map(([, label, value]) => {
      return `<tr><th align="left" style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(label)}</th><td style="padding:8px;border-bottom:1px solid #eee;white-space:pre-wrap;">${escapeHtml(value)}</td></tr>`;
    })
    .join('');

  return `
    <h1 style="font-family:Arial,sans-serif;font-size:22px;">Новая анкета: ${escapeHtml(record.clinicName)}</h1>
    <p style="font-family:Arial,sans-serif;color:#555;">Дата отправки: ${escapeHtml(new Date(record.submittedAt).toLocaleString('ru-RU'))}</p>
    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;width:100%;max-width:760px;">
      ${rows}
    </table>
  `;
}
