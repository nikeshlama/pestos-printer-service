require('dotenv').config();

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const API_BASE_URL = process.env.API_BASE_URL;
const CHECK_INTERVAL = Number(process.env.CHECK_INTERVAL || 5000);

function buildReceiptText(order) {
  const money = (num) => `$${Number(num || 0).toFixed(2)}`;

  const date = new Date(order.createdAt);
  const dateText = date.toLocaleDateString();
  const timeText = date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit'
  });

  let text = '';

  text += "PESTO'S RESTAURANT\n";
  text += "ROOM SERVICE\n";
  text += `${dateText} ${timeText}\n\n`;

  text += `Order #: ${order.orderNumber}\n`;
  text += `Room: ${order.roomNumber}\n`;
  text += `Guest: ${order.guestName}\n\n`;

  text += 'ITEMS\n';

  order.items.forEach((item) => {
    const itemTotal = Number(item.price) * Number(item.quantity);

    text += `${item.quantity} x ${item.name}\n`;

if (item.glutenFree) {
  text += `   **GLUTEN FREE**\n`;
}

if (item.sauce) {
  text += `   Sauce: ${item.sauce}\n`;
}

if (item.secondPound) {
  text += `   + 2nd Pound Wings\n`;
}

if (item.side && !item.sideUpgrade) {
  text += `   Side: ${item.side}\n`;
}

if (item.sideUpgrade) {
  text += `   Upgrade: ${item.sideUpgrade}\n`;
}

if (item.dressing) {
  text += `   Dressing: ${item.dressing}\n`;
}
if (item.saladProtein) {
  text += `   Add-on: ${item.saladProtein}\n`;
}

if (item.doneness) {
  text += `   Steak: ${item.doneness}\n`;
}

    text += '\n';
  });

  text += '\n';
  text += `Subtotal: ${money(order.subtotal)}\n`;
  text += `Gratuity: ${money(order.gratuity)}\n`;
  text += `Tax: ${money(order.tax)}\n`;
  text += `TOTAL: ${money(order.total)}\n\n`;

  if (order.message && order.message.trim()) {
    text += 'MESSAGE\n';
    text += `${order.message.trim()}\n\n`;
  }

  text += 'Thank you!\n';

  return text;
}

async function printOrder(order) {
  const receiptText = buildReceiptText(order);
  const filePath = path.join(__dirname, `order-${order.orderNumber}.txt`);

  fs.writeFileSync(filePath, receiptText, 'utf8');

  await new Promise((resolve, reject) => {
    exec(`notepad /p "${filePath}"`, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  setTimeout(() => {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }, 5000);
}

async function checkOrders() {
  try {
    console.log('Checking for new orders...');

    const response = await axios.get(`${API_BASE_URL}/api/orders/unprinted`);
    const orders = response.data;

    if (!orders || orders.length === 0) {
      console.log('No new orders');
      return;
    }

    for (const order of orders) {
      console.log(`Found order #${order.orderNumber}`);
      console.log(JSON.stringify(order.items, null, 2));

      await printOrder(order);

      await axios.put(`${API_BASE_URL}/api/orders/${order._id}/printed`);

      console.log(`Order #${order.orderNumber} marked as printed`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

console.log('Printer service started');
console.log(`Backend: ${API_BASE_URL}`);
console.log(`Checking every ${CHECK_INTERVAL / 1000} seconds`);

checkOrders();
setInterval(checkOrders, CHECK_INTERVAL);