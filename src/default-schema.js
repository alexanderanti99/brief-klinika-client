export const defaultFormSchema = {
  version: 1,
  sections: [
    {
      id: 'contact',
      eyebrow: 'Для связи',
      title: 'Как к вам обращаться',
      fields: [
        { id: 'contactName', type: 'text', label: 'Ваше имя / должность', required: true },
        { id: 'contactPhone', type: 'text', label: 'Телефон или Telegram для связи', required: true, placeholder: '+7 999 000-00-00 или @username' }
      ]
    },
    {
      id: 'basics',
      eyebrow: 'Раздел 1',
      title: 'Основные данные',
      fields: [
        { id: 'q1_name', type: 'text', label: 'Название клиники / бренда', required: true },
        {
          id: 'q2_logo',
          type: 'radio',
          label: 'Есть ли готовый логотип?',
          required: true,
          options: ['Да, есть', 'Нет, нужна помощь']
        },
        {
          id: 'q2_logo_link',
          type: 'text',
          label: 'Ссылка на логотип',
          placeholder: 'Ссылка на файл логотипа (Google Drive, Telegram и т.п.)',
          showWhen: { fieldId: 'q2_logo', value: 'Да, есть' }
        },
        {
          id: 'q3_colors',
          type: 'text',
          label: 'Фирменные цвета',
          hint: 'Если есть брендбук - вставьте ссылку на файл. Если нет - напишите "нет, помогите подобрать".'
        },
        {
          id: 'q4_type',
          type: 'radio',
          label: 'Тип сайта',
          required: true,
          options: ['Сайт-визитка (1 страница с блоками)', 'Многостраничный сайт', 'Другое']
        },
        { id: 'q4_type_other', type: 'text', label: 'Уточнение типа сайта', placeholder: 'Уточните', showWhen: { fieldId: 'q4_type', value: 'Другое' } }
      ]
    },
    {
      id: 'content',
      eyebrow: 'Раздел 2',
      title: 'Контент для сайта',
      fields: [
        { id: 'q5_services', type: 'textarea', label: 'Список услуг с ценами', hint: 'Текстом ниже или ссылкой на файл', required: true },
        { id: 'q6_photos', type: 'textarea', label: 'Фото клиники, специалистов, оборудования', hint: 'Сколько качественных фото есть, и ссылка на них' },
        {
          id: 'q7_before_after',
          type: 'radio',
          label: 'Фото "до/после" - есть ли, можно ли использовать?',
          options: ['Да, есть и можно использовать', 'Есть, нужно уточнить разрешение', 'Нет, нужно организовать съемку']
        },
        { id: 'q8_cases', type: 'text', label: 'Парные кейсы "до/после + отзыв" от одного клиента', hint: 'Фото до + описание жалобы + фото после + отзыв - сколько полных таких кейсов есть?' },
        { id: 'q9_reviews', type: 'textarea', label: 'Отзывы клиентов (отдельно от парных кейсов)', hint: 'В каком виде, сколько штук, можно ли публиковать' },
        { id: 'q10_contacts', type: 'textarea', label: 'Контакты', hint: 'Адрес, телефон, соцсети, режим работы', required: true },
        {
          id: 'q11_domain',
          type: 'radio',
          label: 'Домен и хостинг',
          options: ['Есть домен и хостинг', 'Есть только домен', 'Ничего нет, нужна помощь']
        }
      ]
    },
    {
      id: 'features',
      eyebrow: 'Раздел 3',
      title: 'Дополнительные функции',
      fields: [
        {
          id: 'features',
          type: 'checkbox',
          label: 'Отметьте все, что интересно',
          hint: 'Можно выбрать несколько. Итоговую стоимость обсудим отдельно.',
          options: [
            'Онлайн-запись (форма без календаря) - 5 000-8 000 ₽',
            'Онлайн-запись (виджет YCLIENTS/DIKIDI) - 5 000-10 000 ₽ + подписка от 850 ₽/мес',
            'Квиз "Подбери процедуру" - 5 000-8 000 ₽',
            'Калькулятор стоимости процедур - 4 000-6 000 ₽',
            'Кнопка WhatsApp/Telegram - 1 000-2 000 ₽',
            'Виджет "Заказать звонок" - 2 000-3 000 ₽',
            'Онлайн-чат на сайте (Jivosite / Talk-Me) - 1 500-2 500 ₽',
            'Другое'
          ]
        },
        { id: 'q_feat_other', type: 'text', label: 'Своя функция', placeholder: 'Если выбрали "Другое" - напишите, что нужно' }
      ]
    },
    {
      id: 'final',
      eyebrow: 'Финал',
      title: 'Сроки и пожелания',
      fields: [
        { id: 'q12_deadline', type: 'text', label: 'Желаемый срок запуска сайта' },
        { id: 'q13_examples', type: 'textarea', label: 'Примеры сайтов, которые нравятся', hint: 'Ссылки и коротко: что именно нравится' },
        { id: 'q14_other', type: 'textarea', label: 'Что еще важно учесть?' }
      ]
    }
  ]
};
