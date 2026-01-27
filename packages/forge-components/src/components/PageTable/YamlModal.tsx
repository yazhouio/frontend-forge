import { CodeEditor, CodeEditorRef } from "@kubed/code-editor";
import { Modal } from "@kubed/components";
import { Eye, Pen } from "@kubed/icons";
import * as React from "react";
import yaml from "../../utils/yaml";

export type YamlModalProps = {
  visible?: boolean;
  readOnly?: boolean;
  yamlValue?: string;
  title?: React.ReactNode;
  onOk?: (value: unknown) => Promise<unknown> | unknown;
};

export const YamlModal = (props: YamlModalProps) => {
  const { visible, readOnly, yamlValue, title, onOk } = props;
  const icon = readOnly ? <Eye /> : <Pen />;
  const codeEditorRef = React.createRef<CodeEditorRef>();
  const footer = readOnly ? null : undefined;
  const bodyHeight = readOnly ? "calc(100vh - 106px)" : "calc(100vh - 170px)";

  const onAsyncOk = async () => {
    if (!onOk) return;
    // @ts-ignore
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
