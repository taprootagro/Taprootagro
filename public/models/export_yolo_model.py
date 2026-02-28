#!/usr/bin/env python3
"""
YOLO 11 农业病虫害模型导出脚本

使用方法：
1. 安装依赖: pip install ultralytics onnx onnxruntime
2. 运行脚本: python export_yolo_model.py
3. 将生成的 yolo11n.onnx 文件放到 public/models/ 目录

"""

import os
from pathlib import Path

def export_yolo11_model(
    model_path='yolo11n.pt',  # 您的训练模型路径
    output_name='yolo11n.onnx',
    imgsz=640,
    simplify=True,
    half=False  # 设置为True使用FP16减小体积
):
    """
    导出YOLO 11模型为ONNX格式
    
    参数:
        model_path: PyTorch模型路径 (.pt)
        output_name: 输出ONNX文件名
        imgsz: 输入图像尺寸 (640推荐)
        simplify: 是否简化ONNX图
        half: 是否使用FP16量化（减小体积）
    """
    try:
        from ultralytics import YOLO
        import onnx
        import onnxruntime as ort
        
        print("=" * 60)
        print("🚀 YOLO 11 农业病虫害模型导出工具")
        print("=" * 60)
        
        # 检查模型文件
        if not os.path.exists(model_path):
            print(f"\n❌ 错误: 找不到模型文件 '{model_path}'")
            print("\n📝 您需要先训练或下载YOLO模型：")
            print("   方法1 (使用预训练模型):")
            print("     from ultralytics import YOLO")
            print("     model = YOLO('yolo11n.pt')  # 自动下载")
            print("\n   方法2 (使用自定义训练模型):")
            print("     model = YOLO('runs/detect/train/weights/best.pt')")
            return False
        
        print(f"\n📂 加载模型: {model_path}")
        model = YOLO(model_path)
        
        # 显示模型信息
        print(f"✅ 模型加载成功")
        print(f"   类别数量: {len(model.names)}")
        print(f"   类别列表: {list(model.names.values())}")
        
        # 导出为ONNX
        print(f"\n🔄 导出为ONNX格式...")
        print(f"   输入尺寸: {imgsz}x{imgsz}")
        print(f"   简化图形: {simplify}")
        print(f"   FP16量化: {half}")
        
        export_path = model.export(
            format='onnx',
            imgsz=imgsz,
            simplify=simplify,
            half=half,
            opset=12,
            dynamic=False  # 固定输入尺寸以提高浏览器性能
        )
        
        # 验证ONNX模型
        print(f"\n🔍 验证ONNX模型...")
        onnx_model = onnx.load(export_path)
        onnx.checker.check_model(onnx_model)
        print("✅ ONNX模型验证通过")
        
        # 测试推理
        print(f"\n🧪 测试ONNX推理...")
        session = ort.InferenceSession(export_path)
        
        input_info = session.get_inputs()[0]
        output_info = session.get_outputs()[0]
        
        print(f"   输入节点: {input_info.name}")
        print(f"   输入形状: {input_info.shape}")
        print(f"   输入类型: {input_info.type}")
        print(f"   输出节点: {output_info.name}")
        print(f"   输出形状: {output_info.shape}")
        print(f"   输出类型: {output_info.type}")
        
        # 重命名文件
        final_path = Path(export_path).parent / output_name
        if export_path != str(final_path):
            Path(export_path).rename(final_path)
            print(f"\n📝 重命名为: {output_name}")
        
        # 显示文件信息
        file_size = os.path.getsize(final_path) / (1024 * 1024)  # MB
        print(f"\n📊 模型文件信息:")
        print(f"   路径: {final_path}")
        print(f"   大小: {file_size:.2f} MB")
        
        if file_size > 20:
            print(f"\n⚠️  警告: 模型文件较大 ({file_size:.2f} MB)")
            print("   建议：")
            print("   1. 使用 half=True 启用FP16量化")
            print("   2. 减小输入尺寸 (如 imgsz=416)")
            print("   3. 考虑使用更小的模型 (yolo11n)")
        
        # 生成类别配置
        print(f"\n📋 生成JavaScript配置...")
        generate_class_config(model.names, final_path.parent / 'classes.json')
        
        print("\n" + "=" * 60)
        print("✅ 导出完成！")
        print("=" * 60)
        print(f"\n📌 下一步：")
        print(f"   1. 将 {output_name} 复制到项目的 public/models/ 目录")
        print(f"   2. 确保类别配置与 yoloDetector.ts 中的 PEST_CLASSES 一致")
        print(f"   3. 重新加载网页，AI将自动使用真实模型")
        print()
        
        return True
        
    except ImportError as e:
        print(f"\n❌ 导入错误: {e}")
        print("\n请安装必要的依赖：")
        print("   pip install ultralytics onnx onnxruntime")
        return False
    except Exception as e:
        print(f"\n❌ 导出失败: {e}")
        return False


def generate_class_config(names_dict, output_path):
    """生成类别配置文件（可选）"""
    import json
    
    config = {
        "classes": list(names_dict.values()),
        "num_classes": len(names_dict),
        "description": "YOLO 11 农业病虫害识别类别配置"
    }
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=2)
    
    print(f"   配置文件: {output_path}")
    print(f"   类��数量: {len(names_dict)}")


def download_sample_model():
    """下载示例YOLO 11 Nano模型"""
    try:
        from ultralytics import YOLO
        
        print("\n📥 下载YOLO 11 Nano预训练模型...")
        model = YOLO('yolo11n.pt')  # 自动下载
        print("✅ 下载完成: yolo11n.pt")
        return True
    except Exception as e:
        print(f"❌ 下载失败: {e}")
        return False


if __name__ == '__main__':
    import sys
    
    print("\n" + "=" * 60)
    print("  YOLO 11 农业病虫害模型导出工具")
    print("=" * 60)
    
    # 检查参数
    if len(sys.argv) > 1:
        if sys.argv[1] == '--download':
            # 下载示例模型
            if download_sample_model():
                print("\n继续导出模型...")
                export_yolo11_model(model_path='yolo11n.pt')
            sys.exit(0)
        elif sys.argv[1] == '--help':
            print("\n用法:")
            print("  python export_yolo_model.py [选项]")
            print("\n选项:")
            print("  --download    下载YOLO 11 Nano预训练模型并导出")
            print("  --help        显示此帮助信息")
            print("\n示例:")
            print("  # 使用自定义模型")
            print("  python export_yolo_model.py")
            print()
            print("  # 下载并导出预训练模型")
            print("  python export_yolo_model.py --download")
            print()
            sys.exit(0)
        else:
            model_path = sys.argv[1]
            export_yolo11_model(model_path=model_path)
    else:
        # 默认行为
        print("\n请选择：")
        print("  1. 使用已有模型文件")
        print("  2. 下载YOLO 11 Nano预训练模型（用于测试）")
        
        choice = input("\n请输入选项 [1/2]: ").strip()
        
        if choice == '2':
            if download_sample_model():
                export_yolo11_model(model_path='yolo11n.pt')
        else:
            model_path = input("\n请输入模型路径 (默认: best.pt): ").strip() or 'best.pt'
            export_yolo11_model(model_path=model_path)
