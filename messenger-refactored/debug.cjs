// debug.cjs — анализирует состояние groupChats и groupChatsVersion
// Запуск: node debug.cjs

const fs = require('fs');
const path = require('path');

// Читаем файлы
const appPath = path.join(__dirname, 'src', 'App.jsx');
const sidebarPath = path.join(__dirname, 'src', 'components', 'Sidebar.jsx');

let appCode = '';
let sidebarCode = '';

try {
    appCode = fs.readFileSync(appPath, 'utf8');
    console.log('✅ App.jsx загружен');
} catch (e) {
    console.log('❌ Ошибка загрузки App.jsx:', e.message);
}

try {
    sidebarCode = fs.readFileSync(sidebarPath, 'utf8');
    console.log('✅ Sidebar.jsx загружен');
} catch (e) {
    console.log('❌ Ошибка загрузки Sidebar.jsx:', e.message);
}

console.log('\n' + '='.repeat(60));
console.log('🔍 АНАЛИЗ КОДА: groupChats и groupChatsVersion');
console.log('='.repeat(60));

// 1. Проверяем, где используется groupChatsVersion
const versionUsage = appCode.match(/groupChatsVersion/g);
console.log(`\n📊 App.jsx: groupChatsVersion упоминается ${versionUsage?.length || 0} раз`);

// 2. Проверяем передачу в Sidebar
const sidebarProps = sidebarCode.match(/groupChatsVersion/g);
console.log(`📊 Sidebar.jsx: groupChatsVersion упоминается ${sidebarProps?.length || 0} раз`);

// 3. Ищем setGroupChatsVersion
const setVersion = appCode.match(/setGroupChatsVersion/g);
console.log(`📊 App.jsx: setGroupChatsVersion вызывается ${setVersion?.length || 0} раз`);

// 4. Ищем обработчики
const addHandlers = appCode.match(/chat_member_added/g);
console.log(`📊 App.jsx: chat_member_added упоминается ${addHandlers?.length || 0} раз`);

const channelAddHandlers = appCode.match(/channel_member_added/g);
console.log(`📊 App.jsx: channel_member_added упоминается ${channelAddHandlers?.length || 0} раз`);

// 5. Проверяем ключи в Sidebar для каналов
const channelKeys = sidebarCode.match(/channel-\$\{.*?\}-/g);
console.log(`📊 Sidebar.jsx: ключи каналов ${channelKeys?.length || 0} раз`);

// 6. Ищем setGroupChatsVersion внутри channel_member_added
const channelMemberAddedBlock = appCode.match(/socket\.on\('channel_member_added'[^}]*}/s);
if (channelMemberAddedBlock) {
    const hasSetVersion = channelMemberAddedBlock[0].includes('setGroupChatsVersion');
    console.log(`📊 channel_member_added содержит setGroupChatsVersion: ${hasSetVersion ? '✅ ДА' : '❌ НЕТ'}`);
}

// 7. Ищем передачу groupChatsVersion в Sidebar
const sidebarPropPass = appCode.match(/groupChatsVersion=\{groupChatsVersion\}/g);
console.log(`📊 groupChatsVersion передается в Sidebar: ${sidebarPropPass?.length > 0 ? '✅ ДА' : '❌ НЕТ'}`);

console.log('\n' + '='.repeat(60));
console.log('📋 ЧТО ПРОВЕРИТЬ ВРУЧНУЮ:');
console.log('='.repeat(60));

console.log('\n1️⃣ В App.jsx найдите socket.on("channel_member_added")');
console.log('   👉 Там должен быть setGroupChatsVersion(prev => prev + 1)');

console.log('\n2️⃣ В Sidebar.jsx найдите рендер каналов:');
console.log('   👉 key={`channel-${channelItem.id}-${groupChatsVersion}`}');

console.log('\n3️⃣ В App.jsx найдите <Sidebar ...>');
console.log('   👉 Должно быть: groupChatsVersion={groupChatsVersion}');

console.log('\n4️⃣ В App.jsx найдите <ProfilePanel ...>');
console.log('   👉 Проверьте, что onMemberAdded не дублирует обновление');