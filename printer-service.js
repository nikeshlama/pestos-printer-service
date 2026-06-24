require('dotenv').config();

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { print } = require('pdf-to-printer');

const API_BASE_URL = process.env.API_BASE_URL;
const PRINTER_NAME = process.env.PRINTER_NAME || 'EPSON TM-T88V Receipt';
const CHECK_INTERVAL = Number(process.env.CHECK_INTERVAL || 5000);

function buildReceiptText(order) {
  const line = '----------------------------------------';
  const width = 40;

  const center = (text) =>
    text.padStart(Math.floor((width + text.length) / 2)).padEnd(width);

  const leftRight = (left, right) => {
    const space = width - left.length - right.length;
    return left + ' '.repeat(Math.max(1, space)) + right;
  };

  let text = '';

  text += center('PESTOS EATERY') + '\n';
  text += center('ROOM SERVICE') + '\n';
  text += line + '\n';
  text += center('ROOM SERVICE ORDER') + '\n';
  text += line + '\n\n';

  text += `Order #: ${order.orderNumber}\n`;
  text += `Room: ${order.roomNumber}\n`;
  text += `Guest: ${order.guestName}\n`;
  text += `Time: ${new Date(order.createdAt).toLocaleString()}\n\n`;

  text += line + '\n';
  text += leftRight('ITEM', 'AMOUNT') + '\n';
  text += line + '\n';

  order.items.forEach(item => {
    const itemTotal = Number(item.price) * Number(item.quantity);
    text += `${item.quantity} x ${item.name}\n`;
    text += leftRight('', `$${itemTotal.toFixed(2)}`) + '\n';
  });

  text += line + '\n';
  text += leftRight('Subtotal', `$${Number(order.subtotal).toFixed(2)}`) + '\n';
  text += leftRight('Gratuity', `$${Number(order.gratuity || 0).toFixed(2)}`) + '\n';
  text += leftRight('Tax', `$${Number(order.tax).toFixed(2)}`) + '\n';
  text += line + '\n';
  text += leftRight('TOTAL', `$${Number(order.total).toFixed(2)}`) + '\n';
  text += line + '\n';

  if (order.message) {
    text += '\nMESSAGE\n';
    text += order.message + '\n';
    text += line + '\n';
  }

  text += '\n';
  text += center('Thank you') + '\n';
  text += center('Please call if you need anything') + '\n';
  text += '\n\n\n';

  return text;
}

async function printOrder(order) {
  const receiptText = buildReceiptText(order);

  const filePath = path.join(__dirname, `order-${order.orderNumber}.txt`);

  fs.writeFileSync(filePath, receiptText, 'utf8');

  await print(filePath, {
    printer: PRINTER_NAME
  });

  fs.unlinkSync(filePath);
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