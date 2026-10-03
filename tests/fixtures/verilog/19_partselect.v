module tb;
  reg [31:0] w; reg [7:0] byte_; integer i; reg [7:0] mem [3:0]; reg [3:0] nib;
  initial begin
    w = 32'h1234_5678;
    for (i = 0; i < 4; i = i + 1) begin byte_ = w[i*8 +: 8]; $display("byte %0d = %h", i, byte_); end
    $display("%h %h", w[31 -: 8], w[15:8]);
    w[23:16] = 8'hAB; $display("%h", w);
    {nib, byte_} = 12'hFED; $display("%h %h", nib, byte_);
    mem[2] = 8'b1100_0011; mem[2][1] = 0; $display("%b", mem[2]);
    w[3] = 1'bx; $display("%b", w[7:0]);
    $display("%h", w[40:33]);
    $finish;
  end
endmodule
