# YOLO 11 Nano 农业病虫害识别模型使用指南

## 📦 模型文件准备

### 1. 获取YOLO 11 Nano模型

您需要准备一个训练好的 YOLO 11 Nano ONNX 模型文件，支持以下方式：

#### 方法A：使用预训练模型（推荐用于演示）
```bash
# 下载 YOLOv11n 通用模型并转换为 ONNX
pip install ultralytics

# Python脚本
from ultralytics import YOLO
model = YOLO('yolo11n.pt')
model.export(format='onnx', imgsz=640)
```

#### 方法B：训练自定义农业病虫害模型
```bash
# 准备数据集（YOLO格式）
# 数据集结构：
# dataset/
#   ├── images/
#   │   ├── train/
#   │   └── val/
#   └── labels/
#       ├── train/
#       └── val/

# 训练模型
from ultralytics import YOLO
model = YOLO('yolo11n.pt')  # 加载预训练权重
results = model.train(
    data='pest_dataset.yaml',
    epochs=100,
    imgsz=640,
    batch=16,
    name='pest_detector'
)

# 导出为ONNX
model.export(format='onnx', imgsz=640)
```

### 2. 数据集标注

推荐使用以下工具标注病虫害数据：
- **LabelImg**: 简单易用的图像标注工具
- **Roboflow**: 在线标注和数据增强平台
- **CVAT**: 功能强大的开源标注工具

### 3. 模型类别配置

确保模型训练的类别与 `/src/app/utils/yoloDetector.ts` 中的 `PEST_CLASSES` 一致：

```typescript
export const PEST_CLASSES = [
  '稻瘟病', '稻纹枯病', '稻细菌性条斑病',
  '小麦锈病', '小麦白粉病', '小麦赤霉病',
  // ... 更多类别
];
```

如果您的模型类别不同，请修改这个数组。

## 📁 文件放置

将训练好的 ONNX 模型文件放到这个目录：

```
public/
  └── models/
      └── yolo11n.onnx  ← 您的模型文件
```

**文件要求：**
- 文件名必须是: `yolo11n.onnx`
- 输入尺寸: 640x640
- 输入格式: `[1, 3, 640, 640]` (NCHW)
- 输出格式: `[1, num_classes+4, 8400]` 或类似的YOLO格式

## 🚀 使用方法

### 自动加载
当模型文件存在时，应用会自动加载：

```typescript
// 在 AIAssistantPage.tsx 中自动执行
useEffect(() => {
  const loadModel = async () => {
    try {
      await detectorRef.current.loadModel('/models/yolo11n.onnx');
      setModelLoaded(true);
      console.log('✅ YOLO模型加载成功');
    } catch (error) {
      console.log('⚠️  模型未找到，使用演示模式');
    }
  };
  loadModel();
}, []);
```

### 模型状态
- ✅ **真实AI模式**: 显示绿色提示 "AI模型已加载"
- 💡 **演示模式**: 显示蓝色提示 "演示模式" （模型文件不存在时）

## 🔧 模型转换详细步骤

### 1. 安装依赖
```bash
pip install ultralytics onnx onnxruntime
```

### 2. 转换脚本
创建 `export_model.py`:

```python
from ultralytics import YOLO
import onnx
import onnxruntime as ort

# 加载PyTorch模型
model = YOLO('best.pt')  # 您训练好的模型

# 导出为ONNX
model.export(
    format='onnx',
    imgsz=640,
    opset=12,
    simplify=True,
    dynamic=False
)

# 验证ONNX模型
onnx_model = onnx.load('best.onnx')
onnx.checker.check_model(onnx_model)

# 测试推理
session = ort.InferenceSession('best.onnx')
print('✅ ONNX模型导出成功！')
print('输入:', session.get_inputs()[0].name, session.get_inputs()[0].shape)
print('输出:', session.get_outputs()[0].name, session.get_outputs()[0].shape)
```

运行脚本：
```bash
python export_model.py
```

### 3. 重命名和部署
```bash
# 重命名模型文件
mv best.onnx yolo11n.onnx

# 复制到项目目录
cp yolo11n.onnx /path/to/project/public/models/
```

## 📊 模型性能优化

### 减小模型体积
```python
# 使用量化减小模型大小
model.export(
    format='onnx',
    imgsz=640,
    half=True,  # FP16量化
    simplify=True
)
```

### 浏览器性能
- **推荐模型**: YOLO 11 Nano (最小、最快)
- **输入尺寸**: 640x640 (标准) 或 416x416 (更快)
- **执行提供商**: WASM (已配置，最佳浏览器兼容性)

## 🎯 训练数据建议

### 最小数据集规模
- 每个类别至少 **100-200张** 图片
- 推荐每个类别 **500-1000张** 图片
- 训练集:验证集 = **80:20** 或 **90:10**

### 数据增强
- 旋转、翻转、缩放
- 亮度、对比度调整
- 模糊、噪声添加
- 随机裁剪

### 标注质量
- 边界框要精确框选病虫害区域
- 避免标注健康部分
- 多角度、多光照条件拍摄

## ❌ 演示模式

如果不提供真实模型，系统会使用模拟模式：
- ✅ 完整的UI和交互流程
- ✅ 模拟的检测结果和边界框
- ✅ 完整的防治建议系统
- ⚠️  检测结果是随机生成的（用于演示）

演示模式适用于：
- 功能原型展示
- UI/UX 测试
- 开发调试

## 📝 常见问题

### Q: 模型文件太大怎么办？
A: YOLO 11 Nano 的 ONNX 模型通常是 5-10MB，可以考虑：
1. 使用 FP16 量化
2. 减少输入尺寸（如 416x416）
3. 部署到CDN或云存储

### Q: 检测速度慢？
A: 在浏览器中运行有性能限制，可以：
1. 降低输入尺寸
2. 减少类别数量
3. 使用更小的模型（Nano已经是最小的）
4. 考虑使用服务器端API

### Q: 类别不匹配？
A: 修改 `yoloDetector.ts` 中的 `PEST_CLASSES` 数组，确保顺序和训练时的 `data.yaml` 一致。

### Q: 浏览器内存不足？
A: YOLO模型需要一定内存，建议：
1. 关闭其他标签页
2. 使用现代浏览器（Chrome 90+, Firefox 88+）
3. 增加浏览器内存限制

## 🔗 相关资源

- [Ultralytics YOLO 文档](https://docs.ultralytics.com/)
- [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/)
- [农业病虫害数据集](https://www.kaggle.com/datasets?search=plant+disease)
- [Roboflow Universe](https://universe.roboflow.com/)

## 📧 技术支持

如需帮助，请参考：
1. YOLO官方文档
2. GitHub Issues
3. 农业技术论坛

---

**注意**: 本项目仅供学习和演示使用，实际农业生产中的病虫害诊断应咨询专业农技人员。
