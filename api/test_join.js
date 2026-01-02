// ФІНАЛЬНИЙ ТЕСТ: Підключення спамера до @seweewe
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram/tl/index.js';

const API_ID = 36209876;
const API_HASH = '77e7d4e5b83a192bf13be09e624f64f7';
const SESSION = '7753335648C8AF7A6EF39FDAFF9C07D0D1D891948682E30D61DD8CBE5D3152B864DAE24C5C41F99F4A566281EAD179A7DA1510D605915D8E37D3086ECB86193842B193026BA662BE03A204806FFAF88C26E27BEAA67EBC3ED019A7E98B9B7DF2F40C1766C336977FCBE4FA7F0B4C1BDD57979A4C4F1B997F14039D3DA06FFF7BEA16FE284B54BCA3DABBF838A651011ABB8CA634F3B71E6F4F2A1B63807B1FA71FEBE1CAAECC93EFA27DD3C1F668A0C141616BB8F85327EE12C217F2ABF34878A242F2187B23574456028841BE3917A14CDF08A31786CCBF9A7C24838E7658D6EA0677B0C0B02807AB039BBC427D49B3F7856A';

async function testJoinChannel() {
  console.log('🔗 Підключення до Telegram...\n');

  const client = new TelegramClient(
    new StringSession(SESSION),
    API_ID,
    API_HASH,
    { connectionRetries: 5 }
  );

  try {
    await client.connect();
    console.log('✅ З\'єднано з Telegram');

    // Перевірка авторизації
    const isAuth = await client.isUserAuthorized();
    console.log('🔐 Авторизація:', isAuth ? '✅' : '❌');

    if (!isAuth) {
      console.error('\n❌ Сесія не авторизована!');
      await client.disconnect();
      return;
    }

    // Приєднатися до каналу @seweewe
    console.log('\n🔗 Приєднання до каналу @seweewe...');

    try {
      await client.invoke(
        new Api.channels.JoinChannel({
          channel: 'seweewe'
        })
      );

      console.log('✅ УСПІШНО ПРИЄДНАНО ДО КАНАЛУ @seweewe!');

      // Отримати інфо про канал
      try {
        const entity = await client.getEntity('seweewe');
        console.log('\n📊 Інформація про канал:');
        console.log('   Назва:', entity.title);
        console.log('   Username: @' + entity.username);
        console.log('   ID:', entity.id?.toString());
      } catch (e) {
        console.log('ℹ️  Не вдалося отримати детальну інформацію');
      }

    } catch (joinError) {
      if (joinError.message && joinError.message.includes('USER_ALREADY_PARTICIPANT')) {
        console.log('✅ ВЖЕ Є УЧАСНИКОМ КАНАЛУ @seweewe!');
      } else if (joinError.message && joinError.message.includes('CHANNEL_PRIVATE')) {
        console.log('⚠️  Канал приватний - потрібне запрошення');
      } else {
        console.error('❌ Помилка:', joinError.message);
      }
    }

    await client.disconnect();
    console.log('\n✅ Готово!');

  } catch (error) {
    console.error('\n❌ Критична помилка:', error.message);
    await client.disconnect();
  }
}

testJoinChannel().catch(console.error);
