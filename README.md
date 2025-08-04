# 🏠 Real Estate Rental Finder

Умный парсер для поиска объявлений аренды недвижимости с поддержкой фильтрации и автоматического анализа сайтов.

## 🚀 Быстрый старт

```bash
# Установка зависимостей
npm install

# Поиск аренды в Софии
npm run rent -- --city sofia --type apartament

# Поиск с фильтрами цены
npm run rent -- --city sofia --type apartament --price-min 800 --price-max 1500

# Анализ нового сайта
npm run analyze https://example-realestate.com
```

## 📋 Доступные команды

### Поиск аренды
```bash
npm run rent -- [опции]
```

**Опции фильтрации:**
- `--city <город>` - sofia, plovdiv, varna, burgas, all (по умолчанию: all)
- `--type <тип>` - apartament, kashta, ofis, studio, staya, all (по умолчанию: all)
- `--price-min <цена>` - минимальная цена в EUR
- `--price-max <цена>` - максимальная цена в EUR
- `--area-min <площадь>` - минимальная площадь в кв.м
- `--area-max <площадь>` - максимальная площадь в кв.м
- `--rooms <количество>` - количество комнат (1,2,3,4,5+)
- `--furnished` - только меблированные объекты
- `--debug` - показать отладочную информацию
- `--output <файл>` - имя выходного файла

### Анализ сайтов
```bash
npm run analyze <URL> [--save]
```

## 📊 Примеры использования

```bash
# Дешевые студии в Софии
npm run rent -- --city sofia --type studio --price-max 1000

# 2-комнатные квартиры в Пловдиве  
npm run rent -- --city plovdiv --type apartament --rooms 2

# Большие квартиры с гаражом
npm run rent -- --city sofia --area-min 80 --price-max 2000

# Меблированные офисы в центре
npm run rent -- --city sofia --type ofis --furnished
```

## 📁 Структура вывода

Результаты сохраняются в:
- `output/rentals/` - результаты поиска аренды
- `output/sales/` - результаты поиска продаж  
- `output/analysis/` - результаты анализа сайтов

## 🏗️ Архитектура

- **Анализатор сайтов** - автоматически определяет структуру и селекторы
- **Система конфигураций** - гибкие настройки для разных сайтов
- **Парсер с фильтрацией** - поддержка пагинации и фильтров
- **CLI интерфейс** - удобные команды для поиска

## 🎯 Поддерживаемые сайты

- ✅ **ues.bg** - Unique Estates (полная поддержка)
- 🔄 Другие сайты - через автоанализ

## 📈 Извлекаемые данные

- Заголовок объявления
- Цена (EUR/BGN/USD)
- Локация (город, район, адрес)
- Площадь и количество комнат
- Тип недвижимости
- Контактная информация
- Изображения
- Ссылки на детальную информацию

## 🔧 Разработка

```bash
# Компиляция TypeScript
npm run build

# Разработка
npm run dev

# Тестирование анализатора
npm run analyze https://ues.bg --save
```

## 📝 API для программного использования

```typescript
import { parseRealEstate, parseUESBG } from './src/index';

// Автоматический анализ и парсинг
const result = await parseRealEstate('https://example.com');

// Специализированный парсер для UES.bg
const listings = await parseUESBG({ 
  city: 'sofia', 
  propertyType: 'apartament',
  priceMax: 1500
});
```