import { SecondaryView } from "./SecondaryView";
import { useLanguage } from "../hooks/useLanguage";
import { useState, useEffect } from "react";
import { Plus, TrendingUp, TrendingDown, Wallet, Calendar, Tag, DollarSign, X, Edit, Trash2 } from "lucide-react";

interface StatementPageProps {
  onClose: () => void;
}

interface Transaction {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  categoryKey: string;
  note: string;
  date: string;
  timestamp: number;
}

export function StatementPage({ onClose }: StatementPageProps) {
  const { t } = useLanguage();
  const s = t.statement;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [formData, setFormData] = useState({
    type: "expense" as "income" | "expense",
    amount: "",
    category: "",
    categoryKey: "",
    note: "",
    date: new Date().toISOString().split("T")[0],
  });

  // 预设分类 - 使用翻译键
  const incomeCategoryKeys = [
    "salary", "bonus", "investment", "partTime", "cropSales", "subsidy", "otherIncome"
  ] as const;
  const expenseCategoryKeys = [
    "seeds", "fertilizer", "pesticide", "equipment", "labor", "rent", "utilities", "transport", "food", "otherExpense"
  ] as const;

  // 获取分类翻译文本
  const getCategoryLabel = (key: string): string => {
    return (s as any)[key] || key;
  };

  // 从 localStorage 加载数据
  useEffect(() => {
    const saved = localStorage.getItem("accounting_transactions");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // 兼容旧数据：如果没有 categoryKey，尝试匹配或直接使用 category
        const migrated = parsed.map((tx: any) => ({
          ...tx,
          categoryKey: tx.categoryKey || tx.category,
        }));
        setTransactions(migrated);
      } catch (e) {
        console.error("Failed to load accounting data:", e);
      }
    }
  }, []);

  // 保存数据到 localStorage
  const saveTransactions = (data: Transaction[]) => {
    localStorage.setItem("accounting_transactions", JSON.stringify(data));
    setTransactions(data);
  };

  // 添加/编辑交易记录
  const handleSubmit = () => {
    const categoryKey = formData.categoryKey || formData.category;
    if (!formData.amount || !categoryKey) {
      alert(s.fillRequired);
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      alert(s.invalidAmount);
      return;
    }

    if (editingTransaction) {
      const updated = transactions.map((tx) =>
        tx.id === editingTransaction.id
          ? {
              ...editingTransaction,
              type: formData.type,
              amount,
              category: formData.category || getCategoryLabel(categoryKey),
              categoryKey,
              note: formData.note,
              date: formData.date,
            }
          : tx
      );
      saveTransactions(updated);
      setEditingTransaction(null);
    } else {
      const newTransaction: Transaction = {
        id: Date.now().toString(),
        type: formData.type,
        amount,
        category: formData.category || getCategoryLabel(categoryKey),
        categoryKey,
        note: formData.note,
        date: formData.date,
        timestamp: new Date(formData.date).getTime(),
      };
      saveTransactions([newTransaction, ...transactions]);
    }

    setFormData({
      type: "expense",
      amount: "",
      category: "",
      categoryKey: "",
      note: "",
      date: new Date().toISOString().split("T")[0],
    });
    setShowAddForm(false);
  };

  // 删除交易记录
  const handleDelete = (id: string) => {
    if (confirm(s.confirmDelete)) {
      saveTransactions(transactions.filter((tx) => tx.id !== id));
    }
  };

  // 编辑交易记录
  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      type: transaction.type,
      amount: transaction.amount.toString(),
      category: transaction.category,
      categoryKey: transaction.categoryKey || transaction.category,
      note: transaction.note,
      date: transaction.date,
    });
    setShowAddForm(true);
  };

  // 计算统计数据
  const stats = transactions.reduce(
    (acc, tx) => {
      if (tx.type === "income") {
        acc.income += tx.amount;
      } else {
        acc.expense += tx.amount;
      }
      return acc;
    },
    { income: 0, expense: 0 }
  );
  const balance = stats.income - stats.expense;

  return (
    <SecondaryView onClose={onClose} title={s.title} showTitle={false}>
      <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--app-bg)' }}>
        {/* 统计卡片 */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 px-4 py-2 shadow-lg">
          <div className="space-y-1.5">
            {/* 总余额 */}
            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Wallet className="w-3 h-3 text-white" />
                </div>
                <span className="text-white font-medium text-xs">{s.balance}</span>
              </div>
              <p className={`font-bold text-sm ${balance >= 0 ? 'text-white' : 'text-red-200'}`}>
                {balance.toFixed(2)}
              </p>
            </div>

            {/* 总收入 */}
            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-3 h-3 text-green-200" />
                </div>
                <span className="text-white font-medium text-xs">{s.income}</span>
              </div>
              <p className="text-white font-bold text-sm">{stats.income.toFixed(2)}</p>
            </div>

            {/* 总支出 */}
            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center flex-shrink-0">
                  <TrendingDown className="w-3 h-3 text-red-200" />
                </div>
                <span className="text-white font-medium text-xs">{s.expense}</span>
              </div>
              <p className="text-white font-bold text-sm">{stats.expense.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* 记账列表 */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-24">
          {transactions.length === 0 ? (
            <div className="text-center py-16">
              <Wallet className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-400 text-sm">{s.noRecords}</p>
              <p className="text-gray-400 text-xs mt-1">{s.startRecording}</p>
            </div>
          ) : (
            transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="bg-white rounded-2xl p-4 shadow-lg active:scale-95 transition-transform"
              >
                {/* 日期 - 左上角 */}
                <div className="flex items-center gap-1 text-gray-400 text-xs mb-3">
                  <Calendar className="w-3 h-3" />
                  {transaction.date}
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* 分类和金额 */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                            transaction.type === "income"
                              ? "bg-green-100"
                              : "bg-red-100"
                          }`}
                        >
                          {transaction.type === "income" ? (
                            <TrendingUp className="w-4 h-4 text-green-600" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-red-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 text-sm">
                            {getCategoryLabel(transaction.categoryKey || transaction.category)}
                          </p>
                        </div>
                      </div>
                      <p
                        className={`font-bold text-lg ${
                          transaction.type === "income"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {transaction.type === "income" ? "+" : "-"}
                        {transaction.amount.toFixed(2)}
                      </p>
                    </div>

                    {/* 备注 */}
                    {transaction.note && (
                      <p className="text-gray-500 text-xs mb-2 line-clamp-2">
                        {transaction.note}
                      </p>
                    )}

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                      <button
                        onClick={() => handleEdit(transaction)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs active:scale-95 transition-transform"
                      >
                        <Edit className="w-3 h-3" />
                        {s.edit}
                      </button>
                      <button
                        onClick={() => handleDelete(transaction.id)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs active:scale-95 transition-transform"
                      >
                        <Trash2 className="w-3 h-3" />
                        {s.delete}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 添加按钮 */}
        <div className="fixed bottom-20 right-4 z-20">
          <button
            onClick={() => {
              setShowAddForm(true);
              setEditingTransaction(null);
              setFormData({
                type: "expense",
                amount: "",
                category: "",
                categoryKey: "",
                note: "",
                date: new Date().toISOString().split("T")[0],
              });
            }}
            className="w-14 h-14 bg-emerald-600 text-white rounded-full shadow-2xl active:scale-90 transition-transform flex items-center justify-center"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        {/* 添加/编辑表单弹窗 */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
            <div className="bg-white w-full rounded-t-3xl max-h-[85vh] overflow-y-auto">
              {/* 表单头部 */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-800">
                  {editingTransaction ? s.editRecord : s.addRecord}
                </h3>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingTransaction(null);
                  }}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center active:scale-90 transition-transform"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* 类型选择 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {s.type}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() =>
                        setFormData({ ...formData, type: "expense", category: "", categoryKey: "" })
                      }
                      className={`py-3 px-4 rounded-xl font-medium text-sm transition-all ${
                        formData.type === "expense"
                          ? "bg-red-600 text-white shadow-lg"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      <TrendingDown className="w-4 h-4 inline mr-1" />
                      {s.expense}
                    </button>
                    <button
                      onClick={() =>
                        setFormData({ ...formData, type: "income", category: "", categoryKey: "" })
                      }
                      className={`py-3 px-4 rounded-xl font-medium text-sm transition-all ${
                        formData.type === "income"
                          ? "bg-green-600 text-white shadow-lg"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      <TrendingUp className="w-4 h-4 inline mr-1" />
                      {s.income}
                    </button>
                  </div>
                </div>

                {/* 金额输入 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {s.amount}
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData({ ...formData, amount: e.target.value })
                      }
                      placeholder="0.00"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-gray-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>
                </div>

                {/* 分类选择 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {s.category}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(formData.type === "income"
                      ? incomeCategoryKeys
                      : expenseCategoryKeys
                    ).map((key) => (
                      <button
                        key={key}
                        onClick={() => setFormData({ ...formData, categoryKey: key, category: "" })}
                        className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                          formData.categoryKey === key
                            ? formData.type === "income"
                              ? "bg-green-600 text-white shadow-lg"
                              : "bg-red-600 text-white shadow-lg"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {getCategoryLabel(key)}
                      </button>
                    ))}
                  </div>
                  {/* 自定义分类输入 */}
                  <input
                    type="text"
                    value={formData.categoryKey && !formData.category ? "" : formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value, categoryKey: e.target.value })
                    }
                    placeholder={s.customCategory}
                    className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-xl text-sm text-gray-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>

                {/* 日期选择 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {s.date}
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) =>
                        setFormData({ ...formData, date: e.target.value })
                      }
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-gray-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>
                </div>

                {/* 备注输入 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {s.noteOptional}
                  </label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <textarea
                      value={formData.note}
                      onChange={(e) =>
                        setFormData({ ...formData, note: e.target.value })
                      }
                      placeholder={s.notePlaceholder}
                      rows={3}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-gray-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                    />
                  </div>
                </div>

                {/* 提交按钮 */}
                <button
                  onClick={handleSubmit}
                  className="w-full py-4 bg-emerald-600 text-white font-bold rounded-xl active:scale-95 transition-transform shadow-lg"
                >
                  {editingTransaction ? s.saveChanges : s.addRecord}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SecondaryView>
  );
}