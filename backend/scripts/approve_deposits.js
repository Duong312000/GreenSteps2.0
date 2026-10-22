const readline = require('readline');
const { Wallet, WalletTransaction, sequelize } = require('../src/models/index');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function main() {
  try {
    console.log('=== GREENSTEPS TERMINAL TRANSACTION APPROVER ===');
    console.log('Connecting to database...');
    await sequelize.authenticate();
    
    // 1. Query pending deposit transactions
    const pendingTransactions = await WalletTransaction.findAll({
      where: {
        type: 'deposit',
        status: 'pending'
      },
      order: [['createdAt', 'ASC']]
    });

    if (pendingTransactions.length === 0) {
      console.log('\n[Thông báo] Không có yêu cầu nạp tiền nào đang chờ duyệt (status = pending).');
      rl.close();
      process.exit(0);
    }

    console.log(`\nTìm thấy ${pendingTransactions.length} yêu cầu nạp tiền đang chờ duyệt:\n`);
    
    // Display list
    for (let i = 0; i < pendingTransactions.length; i++) {
      const tx = pendingTransactions[i];
      // Find wallet owner details
      const wallet = await Wallet.findByPk(tx.wallet_id);
      const userId = wallet ? wallet.user_id : 'Không rõ';
      
      console.log(`[${i + 1}] ID giao dịch: ${tx.id}`);
      console.log(`    - ID ví: ${tx.wallet_id} (Người dùng: ${userId})`);
      console.log(`    - Số tiền nạp: ${Number(tx.amount).toLocaleString('vi-VN')} đ`);
      console.log(`    - Nội dung chuyển khoản: ${tx.description}`);
      console.log(`    - Thời gian yêu cầu: ${new Date(tx.createdAt).toLocaleString('vi-VN')}`);
      console.log('--------------------------------------------------');
    }

    // 2. Prompt user
    rl.question('\nNhập ID giao dịch bạn muốn duyệt (hoặc nhập "all" để duyệt tất cả, "exit" để thoát): ', async (answer) => {
      const cmd = answer.trim();
      
      if (cmd.toLowerCase() === 'exit') {
        console.log('Thoát chương trình.');
        rl.close();
        process.exit(0);
      }

      if (cmd.toLowerCase() === 'all') {
        console.log('\nĐang duyệt toàn bộ giao dịch...');
        const t = await sequelize.transaction();
        try {
          for (const tx of pendingTransactions) {
            tx.status = 'success';
            await tx.save({ transaction: t });

            const wallet = await Wallet.findByPk(tx.wallet_id, { transaction: t });
            if (wallet) {
              wallet.balance = Number(wallet.balance) + Number(tx.amount);
              await wallet.save({ transaction: t });
            }
          }
          await t.commit();
          console.log('[Thành công] Đã duyệt toàn bộ giao dịch nạp tiền thành công!');
        } catch (err) {
          await t.rollback();
          console.error('[Thất bại] Lỗi trong quá trình duyệt gộp:', err.message);
        }
      } else {
        // Find single transaction
        const targetTx = pendingTransactions.find(tx => tx.id === cmd);
        if (!targetTx) {
          console.log('[Lỗi] Không tìm thấy ID giao dịch phù hợp trong danh sách chờ duyệt!');
        } else {
          const t = await sequelize.transaction();
          try {
            targetTx.status = 'success';
            await targetTx.save({ transaction: t });

            const wallet = await Wallet.findByPk(targetTx.wallet_id, { transaction: t });
            if (wallet) {
              // Increment balance
              wallet.balance = Number(wallet.balance) + Number(targetTx.amount);
              await wallet.save({ transaction: t });
            }
            await t.commit();
            console.log(`\n[Thành công] Đã duyệt thành công giao dịch #${cmd}!`);
            console.log(`Số dư mới của ví ${targetTx.wallet_id}: ${Number(wallet.balance).toLocaleString('vi-VN')} đ`);
          } catch (err) {
            await t.rollback();
            console.error('[Thất bại] Lỗi duyệt giao dịch:', err.message);
          }
        }
      }

      rl.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('Lỗi kết nối database:', error);
    rl.close();
    process.exit(1);
  }
}

main();
