import { CodeEditor, CodeEditorRef } from "@kubed/code-editor";
import { Modal, ModalProps } from "@kubed/components";
import { Eye, Pen } from "@kubed/icons";
import * as React from "react";
import yaml from "../../utils/yaml";

export type YamlModalProps = ModalProps & {
  visible?: boolean;
  readOnly?: boolean;
  initialValue?: Record<string, unknown> | Record<string, unknown>[] | string;
  title?: React.ReactNode;
  onOk?: (value: unknown) => Promise<unknown> | unknown;
};

export const YamlModal = (props: YamlModalProps) => {
  const { visible, readOnly, initialValue, title, onOk, ...rest } = props;
  const icon = readOnly ? <Eye /> : <Pen />;
  const codeEditorRef = React.createRef<CodeEditorRef>();
  const footer = readOnly ? null : undefined;
  const bodyHeight = readOnly ? "calc(100vh - 106px)" : "calc(100vh - 170px)";

  const yamlValue = yaml.getValue(initialValue) || "";
  console.log("initialValue", yamlValue);
  const onAsyncOk = async () => {
    if (!onOk) return;
    const newYaml = codeEditorRef.current?.getValue();
    try {
      await onOk(yaml.load(newYaml));
      return true;
    } catch (error) {
      return false;
    }
  };
  return (
    <Modal
      title={title}
      titleIcon={icon}
      visible={visible}
      width="calc(100vw - 40px)"
      className="modal-fullscreen"
      bodyStyle={{ padding: "20px", height: bodyHeight }}
      onAsyncOk={onAsyncOk}
      footer={footer}
      {...rest}
    >
      <CodeEditor
        ref={codeEditorRef}
        mode="yaml"
        acceptFileTypes={[".yaml", ".yml"]}
        fileName="config.yaml"
        readOnly={readOnly}
        value={yamlValue}
      />
    </Modal>
  );
};
