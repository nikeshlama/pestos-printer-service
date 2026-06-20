require('dotenv').config();

const axios = require('axios');
const {
  printer: ThermalPrinter,
  types: PrinterTypes
} = require('node-thermal-printer');

const API_BASE_URL = process.env.API_BASE_URL;
const PRINTER_MODE = process.env.PRINTER_MODE || 'TEST';
const PRINTER_TYPE = process.env.PRINTER_TYPE || 'EPSON';
const PRINTER_NAME = process.env.PRINTER_NAME || '';
const PRINTER_IP = process.env.PRINTER_IP || '';
const CHECK_INTERVAL = Number(process.env.CHECK_INTERVAL || 5000);

let printer = null;

if (PRINTER_MODE !== 'TEST') {
  printer = new ThermalPrinter({
    type: PRINTER_TYPE === 'STAR' ? PrinterTypes.STAR : PrinterTypes.EPSON,
    interface:
      PRINTER_MODE === 'ETHERNET'
        ? `tcp://${PRINTER_IP}:9100`
        : `printer:${PRINTER_NAME}`,
    lineCharacter: '-'
  });
}

async function printOrder(order) {
  if (!printer) {
    console.log('TEST MODE - not printing');
    console.log(order);
    return;
  }

  printer.clear();

  printer.alignCenter();
  printer.bold(true);
  printer.println('ROOM SERVICE ORDER');
  printer.bold(false);
  printer.drawLine();

  printer.alignLeft();
  printer.println(`Order #: ${order.orderNumber}`);
  printer.println(`Room: ${order.roomNumber}`);
  printer.println(`Guest: ${order.guestName}`);
  printer.println(`Time: ${new Date(order.createdAt).toLocaleString()}`);
  printer.drawLine();

  printer.bold(true);
  printer.println('ITEMS');
  printer.bold(false);

  order.items.forEach(item => {
    printer.println(`${item.quantity} x ${item.name}`);
    printer.println(`    $${Number(item.price).toFixed(2)}`);
  });

  printer.drawLine();
  printer.println(`Subtotal: $${Number(order.subtotal).toFixed(2)}`);
  printer.println(`Gratuity: $${Number(order.gratuity || 0).toFixed(2)}`);
  printer.println(`Tax: $${Number(order.tax).toFixed(2)}`);

  printer.bold(true);
  printer.println(`TOTAL: $${Number(order.total).toFixed(2)}`);
  printer.bold(false);

  if (order.message) {
    printer.drawLine();
    printer.bold(true);
    printer.println('MESSAGE');
    printer.bold(false);
    printer.println(order.message);
  }

  printer.drawLine();
  printer.alignCenter();
  printer.println('Thank you');
  printer.cut();

  await printer.execute();
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
console.log(`Mode: ${PRINTER_MODE}`);
console.log(`Type: ${PRINTER_TYPE}`);
console.log(`Printer Name: ${PRINTER_NAME}`);
console.log(`Printer IP: ${PRINTER_IP}`);
console.log(`Checking every ${CHECK_INTERVAL / 1000} seconds`);

checkOrders();
setInterval(checkOrders, CHECK_INTERVAL);