import type { CategoryLocalizations } from "./CategoryLocalizations";

// Legacy Discord-compatible discovery category defaults.
//
// Discord's live /discovery/categories endpoint currently requires authentication,
// and public Discord support documentation lists only high-level browsable category
// names without stable IDs. These rows therefore intentionally use the historical
// 49-row category snapshot that Discord's API returned in 2021:
// https://gist.github.com/noaione/61de9670d2e43193ded8984102fa1231
// Spacebar persists these integer IDs in guild discovery metadata and uses them for
// category filtering. Treat this as seed lookup data that operators may customize,
// not as a verified current live Discord category list.
export interface DefaultDiscoveryCategory {
    id: number;
    name: string;
    localizations: CategoryLocalizations;
    is_primary: boolean;
}

export const DEFAULT_DISCOVERY_CATEGORIES: readonly DefaultDiscoveryCategory[] = [
    { id: 0, name: "General", localizations: {}, is_primary: true },
    { id: 1, name: "Gaming", localizations: { de: "Gaming", fr: "Gaming", ru: "Игры" }, is_primary: true },
    { id: 2, name: "Music", localizations: { de: "Musik", fr: "Musique", ru: "Музыка" }, is_primary: true },
    { id: 3, name: "Entertainment", localizations: { de: "Unterhaltung", fr: "Divertissements", ru: "Развлечение" }, is_primary: true },
    { id: 4, name: "Creative Arts", localizations: { de: "Kreative Künste", fr: "Arts créatifs", ru: "Искусство" }, is_primary: true },
    { id: 5, name: "Science & Tech", localizations: { de: "Wissenschaft & Technik", fr: "Science et technologie", ru: "Наука и техника" }, is_primary: true },
    { id: 6, name: "Education", localizations: { de: "Lernen", fr: "Éducation", ru: "Образование" }, is_primary: true },
    { id: 7, name: "Sports", localizations: { de: "Sport", fr: "Sports", ru: "Спорт" }, is_primary: true },
    { id: 8, name: "Fashion & Beauty", localizations: { de: "Fashion & Beauty", fr: "Mode et beauté", ru: "Мода и красота" }, is_primary: true },
    {
        id: 9,
        name: "Relationships & Identity",
        localizations: { de: "Beziehungen & Identität", fr: "Relations et identité", ru: "Отношения и самоидентификация" },
        is_primary: true,
    },
    { id: 10, name: "Travel & Food", localizations: { de: "Reisen & Essen", fr: "Voyage et nourriture", ru: "Путешествия и еда" }, is_primary: true },
    { id: 11, name: "Fitness & Health", localizations: { de: "Fitness & Gesundheit", fr: "Fitness et santé", ru: "Фитнес и здоровье" }, is_primary: true },
    { id: 12, name: "Finance", localizations: { de: "Finanzen", fr: "Finance", ru: "Финансы" }, is_primary: true },
    { id: 13, name: "Other", localizations: { de: "Sonstiges", fr: "Autre", ru: "Другое" }, is_primary: true },
    { id: 14, name: "General Chatting", localizations: { de: "Allgemeine Chats", fr: "Discussion générale", ru: "Общение" }, is_primary: true },
    { id: 15, name: "Esports", localizations: { de: "E-Sports", fr: "eSport", ru: "Киберспорт" }, is_primary: false },
    { id: 16, name: "Anime & Manga", localizations: { de: "Anime & Manga", fr: "Animés et mangas", ru: "Аниме и манга" }, is_primary: false },
    { id: 17, name: "Movies & TV", localizations: { de: "Film & TV", fr: "Films et TV", ru: "Кино и телевидение" }, is_primary: false },
    { id: 18, name: "Books", localizations: { de: "Bücher", fr: "Livres", ru: "Книги" }, is_primary: false },
    { id: 19, name: "Art", localizations: { de: "Kunst", fr: "Art", ru: "Творчество" }, is_primary: false },
    { id: 20, name: "Writing", localizations: { de: "Schreiben", fr: "Écriture", ru: "Литература" }, is_primary: false },
    {
        id: 21,
        name: "Crafts, DIY, & Making",
        localizations: { de: "Basteln & Handwerk", fr: "Travaux manuels, bricolage et artisanat", ru: "Хобби, рукоделие" },
        is_primary: false,
    },
    { id: 22, name: "Programming", localizations: { de: "Programmieren", fr: "Programmation", ru: "Программирование" }, is_primary: false },
    { id: 23, name: "Podcasts", localizations: { de: "Podcasts", fr: "Podcasts", ru: "Подкасты" }, is_primary: false },
    { id: 24, name: "Tabletop Games", localizations: { de: "Tabletop-Spiele", fr: "Jeux de société", ru: "Настольные игры" }, is_primary: false },
    { id: 25, name: "Memes", localizations: { de: "Memes", fr: "Memes", ru: "Мемы" }, is_primary: false },
    { id: 26, name: "News & Current Events", localizations: { de: "Nachrichten & Zeitgeschehen", fr: "Actualité", ru: "Новости и текущие события" }, is_primary: false },
    { id: 27, name: "Cryptocurrency", localizations: { de: "Kryptowährung", fr: "Cryptomonnaie", ru: "Криптовалюта" }, is_primary: false },
    { id: 28, name: "Investing", localizations: { de: "Geldanlage", fr: "Investissements", ru: "Инвестиции" }, is_primary: false },
    { id: 29, name: "Studying & Teaching", localizations: { de: "Lernen & Lehren", fr: "Études et enseignement", ru: "Обучение" }, is_primary: false },
    { id: 30, name: "LFG", localizations: { de: "LFG", fr: "LFG", ru: "Поиск группы" }, is_primary: false },
    { id: 31, name: "Customer Support", localizations: { de: "Kundensupport", fr: "Assistance clientèle", ru: "Служба поддержки" }, is_primary: false },
    { id: 32, name: "Theorycraft", localizations: { de: "Theorycraft", fr: "Theorycraft", ru: "Теорикрафтинг" }, is_primary: false },
    { id: 33, name: "Events", localizations: { de: "Events", fr: "Événements", ru: "Мероприятия" }, is_primary: false },
    { id: 34, name: "Roleplay", localizations: { de: "Rollenspiele", fr: "Jeux de rôles", ru: "Ролевая игра" }, is_primary: false },
    { id: 35, name: "Content Creator", localizations: { de: "Content Creator", fr: "Créateur de contenu", ru: "Создатель контента" }, is_primary: false },
    { id: 36, name: "Business", localizations: { de: "Unternehmen", fr: "Activités commerciales", ru: "Бизнес" }, is_primary: false },
    { id: 37, name: "Local Group", localizations: { de: "Lokale Gruppen", fr: "Groupe local", ru: "Местная группа" }, is_primary: false },
    { id: 38, name: "Collaboration", localizations: { de: "Kollaboration", fr: "Collaboration", ru: "Совместная работа" }, is_primary: false },
    { id: 39, name: "Fandom", localizations: { de: "Fan-Community", fr: "Communauté de fans", ru: "Фанатское сообщество" }, is_primary: false },
    { id: 40, name: "Wiki & Guide", localizations: { de: "Wiki & Anleitungen", fr: "Wiki et guide", ru: "Вики и руководство" }, is_primary: false },
    { id: 42, name: "Subreddit", localizations: { de: "Subreddit", fr: "Subreddit", ru: "Сабреддит" }, is_primary: false },
    { id: 43, name: "Emoji", localizations: { de: "Emoji", fr: "Émoji", ru: "Эмодзи" }, is_primary: true },
    { id: 44, name: "Comics & Cartoons", localizations: {}, is_primary: false },
    { id: 45, name: "Mobile", localizations: {}, is_primary: false },
    { id: 46, name: "Console", localizations: {}, is_primary: false },
    { id: 47, name: "Charity & Nonprofit", localizations: {}, is_primary: false },
    { id: 48, name: "Game Developer", localizations: {}, is_primary: false },
    { id: 49, name: "Bots", localizations: {}, is_primary: true },
];
