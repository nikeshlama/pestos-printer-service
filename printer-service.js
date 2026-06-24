require('dotenv').config();

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const API_BASE_URL = process.env.API_BASE_URL;
const PRINTER_NAME = process.env.PRINTER_NAME || 'EPSON TM-T88V Receipt';
const CHECK_INTERVAL = Number(process.env.CHECK_INTERVAL || 5000);

function buildReceiptText(order) {
  const money = (num) => `$${Number(num || 0).toFixed(2)}`;
  const line = '------------------------------';

  const date = new Date(order.createdAt);
  const dateText = date.toLocaleDateString();
  const timeText = date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit'
  });

  let text = '';

  text += "PESTO'S RESTAURANT\n";
  text += 'ROOM SERVICE\n';
  text += `${dateText} ${timeText}\n`;
  text += line + '\n';

  text += `Order #: ${order.orderNumber}\n`;
  text += `Room: ${order.roomNumber}\n`;
  text += `Guest: ${order.guestName}\n`;
  text += line + '\n';

  text += 'QTY ITEM              PRICE\n';
  text += line + '\n';

  order.items.forEach((item) => {
    const qty = String(item.quantity).padEnd(4);

    let itemName = String(item.name || '');

    if (itemName.length > 16) {
      itemName = itemName.substring(0, 16);
    }

    itemName = itemName.padEnd(16);

    const itemTotal = money(
      Number(item.price) * Number(item.quantity)
    ).padStart(8);

    text += `${qty}${itemName}${itemTotal}\n`;
  });

  text += line + '\n';
  text += 'Subtotal'.padEnd(22) + money(order.subtotal).padStart(8) + '\n';
  text += 'Gratuity'.padEnd(22) + money(order.gratuity).padStart(8) + '\n';
  text += 'Tax'.padEnd(22) + money(order.tax).padStart(8) + '\n';
  text += line + '\n';
  text += 'TOTAL'.padEnd(22) + money(order.total).padStart(8) + '\n';
  text += line + '\n';

  if (order.message && order.message.trim()) {
    text += 'MESSAGE\n';
    text += order.message.trim() + '\n';
    text += line + '\n';
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
console.log(`Printer Name: ${PRINTER_NAME}`);
console.log(`Checking every ${CHECK_INTERVAL / 1000} seconds`);

checkOrders();
setInterval(checkOrders, CHECK_INTERVAL);