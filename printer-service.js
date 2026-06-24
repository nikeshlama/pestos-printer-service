require('dotenv').config();

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { print } = require('pdf-to-printer');

const API_BASE_URL = process.env.API_BASE_URL;
const PRINTER_NAME = process.env.PRINTER_NAME || 'EPSON TM-T88V Receipt';
const CHECK_INTERVAL = Number(process.env.CHECK_INTERVAL || 5000);

function buildReceiptText(order) {
  const width = 32;
  const line = '-'.repeat(width);

  const money = (num) => `$${Number(num || 0).toFixed(2)}`;

  const center = (text) => {
    const spaces = Math.floor((width - text.length) / 2);
    return ' '.repeat(Math.max(0, spaces)) + text;
  };

  const row = (left, right) => {
    left = String(left);
    right = String(right);
    const spaces = width - left.length - right.length;
    return left + ' '.repeat(Math.max(1, spaces)) + right;
  };

  let text = '';

  text += center('PESTOS EATERY') + '\n';
  text += center('ROOM SERVICE') + '\n';
  text += line + '\n';
  text += center('ORDER TICKET') + '\n';
  text += line + '\n';

  text += `Order #: ${order.orderNumber}\n`;
  text += `Room: ${order.roomNumber}\n`;
  text += `Guest: ${order.guestName}\n`;
  text += `Time: ${new Date(order.createdAt).toLocaleString()}\n`;
  text += line + '\n';

  text += 'ITEMS\n';

  order.items.forEach(item => {
    const itemTotal = Number(item.price) * Number(item.quantity);
    text += `${item.quantity} x ${item.name}\n`;
    text += row('', money(itemTotal)) + '\n';
  });

  if (order.message) {
    text += 'MESSAGE\n';
    text += `${order.message}\n`;
    text += line + '\n';
  }
  
  text += line + '\n';
  text += row('Subtotal', money(order.subtotal)) + '\n';
  text += row('Gratuity', money(order.gratuity)) + '\n';
  text += row('Tax', money(order.tax)) + '\n';
  text += line + '\n';
  text += row('TOTAL', money(order.total)) + '\n';
  text += line + '\n';


  text += center('Thank you') + '\n';
  text += '\n\n\n';

  return text;
}

async function printOrder(order) {
  const receiptText = buildReceiptText(order);

  const filePath = path.join(__dirname, `order-${order.orderNumber}.txt`);

  fs.writeFileSync(filePath, receiptText, 'utf8');

  const { exec } = require('child_process');

  await new Promise((resolve, reject) => {
    const command = `notepad /p "${filePath}"`;

    exec(command, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
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